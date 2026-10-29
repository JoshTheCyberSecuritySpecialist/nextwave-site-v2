import { createHash, randomBytes } from 'node:crypto';

const ADMIN_EMAIL = 'joshua@nextwavedigitalsolution.com';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const TOKEN = /^[a-f0-9]{64}$/;

const DATABASE_MESSAGES = new Map([
  ['order not found', 'Not found'],
  ['organization not found', 'Not found'],
  ['invitation not found', 'Not found'],
  ['order is not paid', 'Order is not paid'],
  ['invalid or expired invitation', 'Invitation unavailable'],
  ['membership disabled', 'Invitation unavailable'],
  ['user cap exceeded', 'Invitation unavailable'],
  ['invitation already accepted', 'Invitation closed'],
  ['invalid token', 'Invalid request'],
  ['invalid actor', 'Invalid request'],
  ['invalid status', 'Invalid request'],
]);

function originOf(url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw Error('Invalid Supabase URL'); }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw Error('Invalid Supabase URL');
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) throw Error('Invalid Supabase URL');
  return parsed.origin;
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function invitationToken() {
  return randomBytes(32).toString('hex');
}

function mappedDatabaseError(body) {
  const text = body && typeof body.message === 'string' ? body.message : '';
  for (const [needle, safe] of DATABASE_MESSAGES) {
    if (text.includes(needle)) return safe;
  }
  return '';
}

export function createCrmProvisioning({ url, serviceKey, fetchImpl = fetch, adminEmail = ADMIN_EMAIL }) {
  const origin = originOf(url);
  if (typeof serviceKey !== 'string' || serviceKey.length < 20) throw Error('Supabase service key required');
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: 'application/json', 'Content-Type': 'application/json' };

  async function rpc(name, args) {
    const response = await fetchImpl(new URL(`/rest/v1/rpc/${name}`, origin), {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000), headers, body: JSON.stringify(args),
    });
    if (!response.ok) {
      let body = null;
      try { body = await response.json(); } catch { body = null; }
      const mapped = mappedDatabaseError(body);
      if (mapped) throw Error(mapped);
      throw Error('Database operation failed');
    }
    const result = await response.json();
    if (!result || typeof result !== 'object' || Array.isArray(result) || !UUID.test(result.organization_id ?? '')) throw Error('Database operation failed');
    return result;
  }

  async function identity(jwt, { adminOnly }) {
    if (typeof jwt !== 'string' || jwt.length > 4096 || !JWT.test(jwt) || jwt === serviceKey) throw Error('Unauthorized');
    const response = await fetchImpl(new URL('/auth/v1/user', origin), {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { apikey: serviceKey, Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
    });
    if (!response.ok) throw Error('Unauthorized');
    const user = await response.json();
    if (!user || typeof user.email !== 'string' || !UUID.test(user.id ?? '')) throw Error('Unauthorized');
    const email = user.email.toLowerCase();
    if (adminOnly && email !== adminEmail) throw Error('Unauthorized');
    return { id: user.id, email };
  }

  return {
    async provision(jwt, orderId) {
      const actor = await identity(jwt, { adminOnly: true });
      if (!UUID.test(orderId ?? '')) throw Error('Invalid request');
      const token = invitationToken();
      const result = await rpc('crm_provision_organization', { p_order_id: orderId, p_token_hash: hashToken(token), p_actor_email: actor.email });
      return {
        organizationId: result.organization_id,
        duplicate: result.duplicate === true,
        status: typeof result.status === 'string' ? result.status : 'provisioned',
        packageId: typeof result.package_id === 'string' ? result.package_id : null,
        invitationToken: result.duplicate === true ? null : token,
      };
    },
    async reissue(jwt, organizationId) {
      const actor = await identity(jwt, { adminOnly: true });
      if (!UUID.test(organizationId ?? '')) throw Error('Invalid request');
      const token = invitationToken();
      const result = await rpc('crm_reissue_invitation', { p_organization_id: organizationId, p_token_hash: hashToken(token), p_actor_email: actor.email });
      return { organizationId: result.organization_id, invitationToken: token, duplicate: false };
    },
    async setStatus(jwt, organizationId, status) {
      const actor = await identity(jwt, { adminOnly: true });
      if (!UUID.test(organizationId ?? '') || (status !== 'active' && status !== 'suspended')) throw Error('Invalid request');
      const result = await rpc('crm_set_organization_status', { p_organization_id: organizationId, p_status: status, p_actor_email: actor.email });
      return { organizationId: result.organization_id, status: typeof result.status === 'string' ? result.status : status, duplicate: result.duplicate === true };
    },
    async accept(jwt, token) {
      const user = await identity(jwt, { adminOnly: false });
      if (typeof token !== 'string' || !TOKEN.test(token)) throw Error('Invalid request');
      const result = await rpc('crm_accept_invitation', { p_user_id: user.id, p_email: user.email, p_token_hash: hashToken(token) });
      return { organizationId: result.organization_id, role: typeof result.role === 'string' ? result.role : null, duplicate: result.duplicate === true };
    },
  };
}
