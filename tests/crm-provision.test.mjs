import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createCrmProvisioning } from '../server/crm-provision.mjs';
import { productionServer } from '../server/production-server.mjs';

const serviceKey = 'service-role-key-not-for-browser-use';
const adminJwt = 'header.payload.signature';
const memberJwt = 'member.payload.signature';
const orderId = '11111111-1111-4111-8111-111111111111';
const orgId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function json(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function hash(token) {
  return createHash('sha256').update(token).digest('hex');
}

test('provisioning is limited to the platform admin and returns an invitation code once', async () => {
  const calls = [];
  let provisions = 0;
  const fetchImpl = async (url, options) => {
    const href = String(url);
    calls.push({ href, body: options.body });
    assert.equal(options.headers.apikey, serviceKey);
    if (href.endsWith('/auth/v1/user')) {
      const token = options.headers.Authorization.slice('Bearer '.length);
      if (token === adminJwt) return json({ id: userId, email: 'Joshua@nextwavedigitalsolution.com' });
      if (token === memberJwt) return json({ id: userId, email: 'owner-a@example.test' });
      return json({ message: 'bad' }, 401);
    }
    const args = JSON.parse(options.body);
    assert.equal(typeof args.p_token_hash, 'string');
    assert.equal(args.p_token_hash.length, 64);
    assert.equal(JSON.stringify(args).includes('invitationToken'), false);
    provisions += 1;
    if (provisions === 1) return json({ organization_id: orgId, duplicate: false, status: 'provisioned', package_id: 'website-crm' });
    return json({ organization_id: orgId, duplicate: true, status: 'provisioned', package_id: 'website-crm' });
  };
  const crm = createCrmProvisioning({ url: 'https://example.supabase.co', serviceKey, fetchImpl });
  await assert.rejects(crm.provision(memberJwt, orderId), /Unauthorized/);
  await assert.rejects(crm.provision('not-a-jwt', orderId), /Unauthorized/);
  const first = await crm.provision(adminJwt, orderId);
  assert.equal(first.duplicate, false);
  assert.equal(first.organizationId, orgId);
  assert.match(first.invitationToken, /^[a-f0-9]{64}$/);
  const sent = JSON.parse(calls.find(call => call.href.includes('crm_provision_organization')).body);
  assert.equal(sent.p_token_hash, hash(first.invitationToken));
  assert.equal(sent.p_actor_email, 'joshua@nextwavedigitalsolution.com');
  assert.equal(JSON.stringify(sent).includes(first.invitationToken), false);
  const second = await crm.provision(adminJwt, orderId);
  assert.equal(second.duplicate, true);
  assert.equal(second.invitationToken, null);
  assert.equal(second.organizationId, orgId);
});

test('accept uses the authenticated account email and ignores a body email', async () => {
  const fetchImpl = async (url, options) => {
    const href = String(url);
    if (href.endsWith('/auth/v1/user')) return json({ id: userId, email: 'owner-a@example.test' });
    const args = JSON.parse(options.body);
    assert.equal(args.p_email, 'owner-a@example.test');
    assert.equal(args.p_user_id, userId);
    assert.equal(Object.hasOwn(args, 'email'), false);
    return json({ organization_id: orgId, role: 'owner', duplicate: false });
  };
  const crm = createCrmProvisioning({ url: 'https://example.supabase.co', serviceKey, fetchImpl });
  const token = 'ab'.repeat(32);
  const accepted = await crm.accept(memberJwt, token);
  assert.equal(accepted.organizationId, orgId);
  await assert.rejects(crm.accept(memberJwt, 'short'), /Invalid request/);
});

test('workspace routes reject anonymous callers and leave checkout in place', async () => {
  const crm = {
    async provision(jwt, orderIdArg) {
      assert.equal(jwt, adminJwt);
      assert.equal(orderIdArg, orderId);
      return { organizationId: orgId, duplicate: false, status: 'provisioned', packageId: 'website-crm', invitationToken: 'cd'.repeat(32) };
    },
    async accept(jwt, token) {
      assert.equal(jwt, memberJwt);
      assert.equal(token, 'ab'.repeat(32));
      return { organizationId: orgId, role: 'owner', duplicate: false };
    },
  };
  const server = productionServer({
    payments: { origin: 'http://127.0.0.1:5173', corsOrigins: ['http://127.0.0.1:5173'], async checkout() { return { id: 'order-1', mode: 'stripe-test' }; } },
    provisioning: crm,
    env: {},
  });
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', error => error ? reject(error) : resolve()));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const origin = { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' };
    let response = await fetch(`${base}/api/admin/organizations`, { method: 'POST', headers: origin, body: '{}' });
    assert.equal(response.status, 401);
    response = await fetch(`${base}/api/admin/organizations`, { method: 'POST', headers: { ...origin, Authorization: `Bearer ${adminJwt}` }, body: JSON.stringify({ orderId }) });
    assert.equal(response.status, 200);
    const created = await response.json();
    assert.equal(created.organizationId, orgId);
    assert.equal(JSON.stringify(created).includes('token_hash'), false);
    response = await fetch(`${base}/api/crm/invitations/accept`, { method: 'POST', headers: { ...origin, Authorization: `Bearer ${memberJwt}` }, body: JSON.stringify({ token: 'ab'.repeat(32), email: 'attacker@example.test' }) });
    assert.equal(response.status, 200);
    response = await fetch(`${base}/api/checkout`, { method: 'POST', headers: origin, body: '{}' });
    assert.equal(response.status, 200);
    const login = await readFile(new URL('../src/pages/CrmLogin.tsx', import.meta.url), 'utf8');
    const auth = await readFile(new URL('../src/contexts/AuthContext.tsx', import.meta.url), 'utf8');
    const offers = await readFile(new URL('../src/data/offers.ts', import.meta.url), 'utf8');
    assert.match(login, /signInWithPassword/);
    assert.equal(login.includes('joshua@nextwavedigitalsolution.com'), false);
    assert.match(auth, /joshua@nextwavedigitalsolution.com/);
    assert.match(offers, /\$799/);
    assert.match(offers, /\$1,499/);
    assert.match(offers, /One location, one staff calendar/);
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections?.(); });
  }
});
