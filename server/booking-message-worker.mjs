import { runBookingMessageBatch } from './booking-messages.mjs';

const FROM = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function originOf(url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw Error('Invalid Supabase URL'); }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw Error('Invalid Supabase URL');
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) throw Error('Invalid Supabase URL');
  return parsed.origin;
}

export function createBookingMessageDeliver({ resendKey, fromEmail, fetchImpl = fetch }) {
  const canSend = typeof resendKey === 'string' && resendKey.length >= 8 && typeof fromEmail === 'string' && FROM.test(fromEmail);
  return async function deliver(message) {
    if (!canSend) throw Error('Booking email delivery is not configured.');
    if (!message?.to || !message?.subject || !message?.text) throw Error('Invalid booking message');
    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(message.idempotencyKey ? { 'Idempotency-Key': String(message.idempotencyKey) } : {}),
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
    if (!response.ok) throw Error('Booking message delivery failed.');
  };
}

export function createBookingMessageRpc({ url, serviceKey, fetchImpl = fetch }) {
  const origin = originOf(url);
  if (typeof serviceKey !== 'string' || serviceKey.length < 20) throw Error('Supabase service key required');
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  return async function rpc(name, args = {}) {
    const response = await fetchImpl(new URL(`/rest/v1/rpc/${name}`, origin), {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
      headers,
      body: JSON.stringify(args),
    });
    if (!response.ok) throw Error('Database operation failed');
    return response.json();
  };
}

export function startBookingMessageWorker({
  url,
  serviceKey,
  resendKey,
  fromEmail,
  fetchImpl = fetch,
  intervalMs = 30_000,
  run = runBookingMessageBatch,
}) {
  const canSend = typeof resendKey === 'string' && resendKey.length >= 8 && typeof fromEmail === 'string' && FROM.test(fromEmail);
  if (!canSend) return { stop() {}, enabled: false };
  const rpc = createBookingMessageRpc({ url, serviceKey, fetchImpl });
  const deliver = createBookingMessageDeliver({ resendKey, fromEmail, fetchImpl });
  let stopped = false;
  let running = false;

  async function tick() {
    if (stopped || running) return;
    running = true;
    try {
      await run({ rpc, deliver });
    } catch {
      // Keep the interval alive; the next tick retries.
    } finally {
      running = false;
    }
  }

  const timer = setInterval(() => { void tick(); }, intervalMs);
  void tick();
  return {
    enabled: true,
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}
