const ADMIN_EMAIL = 'joshua@nextwavedigitalsolution.com';
const MESSAGE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FROM = /^(?:[^\r\n<>]{1,80}<)?[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>?$/;

function originOf(url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw Error('Invalid Supabase URL'); }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw Error('Invalid Supabase URL');
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) throw Error('Invalid Supabase URL');
  return parsed.origin;
}

function cleanText(value, max) {
  return typeof value === 'string' && value.length <= max ? value : null;
}

function preview(body) {
  const clean = body.replace(/\s+/g, ' ').trim();
  return clean.length > 160 ? `${clean.slice(0, 157)}…` : clean;
}

function messageRow(row) {
  if (!row || typeof row !== 'object') return null;
  const id = typeof row.id === 'string' ? row.id.toLowerCase() : '';
  const email = cleanText(row.email, 254);
  const name = cleanText(row.name, 120);
  const body = cleanText(row.body, 5000);
  const status = row.status === 'open' || row.status === 'replied' ? row.status : '';
  const createdAt = cleanText(row.created_at, 40);
  if (!MESSAGE_ID.test(id) || !name || !email || !EMAIL.test(email) || email !== email.toLowerCase() || !body || !status || !createdAt) return null;
  return {
    id,
    name,
    email,
    phone: cleanText(row.phone, 20),
    businessName: cleanText(row.business_name, 160),
    service: cleanText(row.service, 160),
    body,
    preview: preview(body),
    status,
    createdAt,
  };
}

function replyRow(row) {
  if (!row || typeof row !== 'object') return null;
  const id = typeof row.id === 'string' ? row.id.toLowerCase() : '';
  const body = cleanText(row.body, 5000);
  const sentAt = cleanText(row.sent_at, 40);
  if (!MESSAGE_ID.test(id) || !body || !sentAt) return null;
  return { id, body, sentAt };
}

function subjectFor(message) {
  const service = message.service?.replace(/[\r\n]+/g, ' ').trim();
  return (service ? `Re: ${service}` : 'Re: your message to NextWave Digital Solutions').slice(0, 200);
}

export function createAdminMessages({ url, serviceKey, fetchImpl = fetch, adminEmail = ADMIN_EMAIL, resendKey = '', fromEmail = '' }) {
  const origin = originOf(url);
  if (typeof serviceKey !== 'string' || serviceKey.length < 20) throw Error('Supabase service key required');
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: 'application/json' };
  const canSend = typeof resendKey === 'string' && resendKey.length >= 8 && typeof fromEmail === 'string' && FROM.test(fromEmail);

  async function rest(table, params) {
    const endpoint = new URL(`/rest/v1/${table}`, origin);
    for (const [key, value] of Object.entries(params)) endpoint.searchParams.set(key, value);
    const response = await fetchImpl(endpoint, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000), headers });
    if (!response.ok) throw Error('Database operation failed');
    const body = await response.json();
    if (!Array.isArray(body)) throw Error('Invalid database result');
    return body;
  }

  async function mutate(method, table, params, body) {
    const endpoint = new URL(`/rest/v1/${table}`, origin);
    for (const [key, value] of Object.entries(params)) endpoint.searchParams.set(key, value);
    const response = await fetchImpl(endpoint, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw Error('The reply was sent but could not be saved.');
    const payload = await response.json();
    if (!Array.isArray(payload)) throw Error('The reply was sent but could not be saved.');
    return payload;
  }

  async function caller(jwt) {
    if (typeof jwt !== 'string' || jwt.length > 4096 || !JWT.test(jwt) || jwt === serviceKey) throw Error('Unauthorized');
    const response = await fetchImpl(new URL('/auth/v1/user', origin), {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { apikey: serviceKey, Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
    });
    if (!response.ok) throw Error('Unauthorized');
    const user = await response.json();
    if (!user || typeof user.email !== 'string' || user.email.toLowerCase() !== adminEmail) throw Error('Unauthorized');
    return user.email.toLowerCase();
  }

  async function loadOne(id) {
    const rows = await rest('site_messages', {
      select: 'id,name,email,phone,business_name,service,body,status,created_at',
      id: `eq.${id}`,
      limit: '1',
    });
    return messageRow(rows[0]);
  }

  return {
    async list(jwt) {
      await caller(jwt);
      const rows = await rest('site_messages', {
        select: 'id,name,email,phone,business_name,service,body,status,created_at',
        order: 'created_at.desc',
        limit: '200',
      });
      const messages = rows.map(messageRow).filter(Boolean).map(({ body, phone, ...message }) => message);
      return { messages };
    },
    async get(jwt, id) {
      await caller(jwt);
      const messageId = typeof id === 'string' ? id.toLowerCase() : '';
      if (!MESSAGE_ID.test(messageId)) throw Error('Not found');
      const [message, replies] = await Promise.all([
        loadOne(messageId),
        rest('site_message_replies', {
          select: 'id,body,sent_at',
          message_id: `eq.${messageId}`,
          order: 'sent_at.asc',
          limit: '50',
        }),
      ]);
      if (!message) throw Error('Not found');
      return { message, replies: replies.map(replyRow).filter(Boolean) };
    },
    async reply(jwt, id, input) {
      await caller(jwt);
      const messageId = typeof id === 'string' ? id.toLowerCase() : '';
      if (!MESSAGE_ID.test(messageId)) throw Error('Not found');
      const text = typeof input?.body === 'string' ? input.body.trim() : '';
      if (text.length < 1 || text.length > 5000 || text.includes('\0')) throw Error('Invalid reply');
      const message = await loadOne(messageId);
      if (!message) throw Error('Not found');
      if (!canSend) throw Error('Email replies are not configured.');
      let response;
      try {
        response = await fetchImpl('https://api.resend.com/emails', {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            from: fromEmail,
            to: [message.email],
            reply_to: adminEmail,
            subject: subjectFor(message),
            text: `${text}\n\n—\nNextWave Digital Solutions`,
          }),
        });
      } catch {
        throw Error('The reply could not be sent.');
      }
      if (!response.ok) throw Error('The reply could not be sent.');
      let saved;
      try {
        saved = replyRow((await mutate('POST', 'site_message_replies', {}, { message_id: messageId, body: text }))[0]);
        const updated = messageRow((await mutate('PATCH', 'site_messages', { id: `eq.${messageId}` }, { status: 'replied' }))[0]);
        if (!saved || !updated || updated.status !== 'replied') throw Error('The reply was sent but could not be saved.');
      } catch (error) {
        if (error instanceof Error && error.message === 'The reply was sent but could not be saved.') throw error;
        throw Error('The reply was sent but could not be saved.');
      }
      return { reply: saved, status: 'replied' };
    },
  };
}
