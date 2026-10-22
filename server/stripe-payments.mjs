import { createHash, createHmac, randomBytes } from 'node:crypto';
import { packages, verify } from './payments.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
export const LOCAL_DEV_ORIGINS = Object.freeze(['http://127.0.0.1:5173', 'http://localhost:5173']);
export const PRODUCTION_WEB_ORIGINS = Object.freeze(['https://nextwavedigitalsolution.com', 'https://www.nextwavedigitalsolution.com']);
const PREVIEW_HOST = /^nextwave-site-v2(?:-[a-z0-9-]{1,80})?\.vercel\.app$/;
export function isAllowedPreviewOrigin(origin) {
  if (typeof origin !== 'string' || origin.length > 200) return false;
  let url;
  try { url = new URL(origin); } catch { return false; }
  if (url.origin !== origin || url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) return false;
  return PREVIEW_HOST.test(url.hostname);
}
export function testOnly(env = process.env) {
  if (env.NODE_ENV === 'production') throw Error('Test backend forbidden in production');
}
export function assertStripeKeyMatchesMode(secretKey, stripeMode) {
  if (stripeMode !== 'test' && stripeMode !== 'live') throw Error('STRIPE_MODE must be test or live');
  const live = /^(sk|rk)_live_[A-Za-z0-9]+$/.test(secretKey ?? '');
  const test = /^(sk|rk)_test_[A-Za-z0-9]+$/.test(secretKey ?? '');
  if (!live && !test) throw Error('Stripe secret key is missing or invalid');
  if ((stripeMode === 'live') !== live) throw Error('Stripe live/test environment mismatch');
  return live;
}
export function createStripe({ secretKey, fetchImpl = fetch, env = process.env, production = false, livemode = false }) {
  if (!production) {
    testOnly(env);
    if (!/^(sk|rk)_test_[A-Za-z0-9]+$/.test(secretKey ?? '')) throw Error('Stripe test secret required');
    if (livemode) throw Error('Stripe live/test environment mismatch');
  } else if (assertStripeKeyMatchesMode(secretKey, livemode ? 'live' : 'test') !== livemode) throw Error('Stripe live/test environment mismatch');
  const sessionPattern = livemode ? /^cs_live_[A-Za-z0-9_]+$/ : /^cs_test_[A-Za-z0-9_]+$/;
  async function request(path, body, key) {
    const response = await fetchImpl(`https://api.stripe.com/v1/${path}`, {
      method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${secretKey}`, 'Stripe-Version': '2024-06-20', ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': key } : {}) },
      ...(body ? { body: new URLSearchParams(body).toString() } : {}),
    });
    if (!response.ok) throw Error('Stripe request failed');
    const session = await response.json();
    if (session.livemode !== livemode || !sessionPattern.test(session.id ?? '')) throw Error(production ? 'Stripe live/test environment mismatch' : 'Not a test checkout session');
    return session;
  }
  return {
    create(order, origin) {
      return request('checkout/sessions', {
        mode: 'payment', customer_email: order.email, client_reference_id: order.id,
        'metadata[order_id]': order.id, 'line_items[0][quantity]': '1',
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][unit_amount]': String(order.amount),
        'line_items[0][price_data][product_data][name]': order.packageId,
        success_url: `${origin}/checkout/success?order=${encodeURIComponent(order.id)}`,
        cancel_url: `${origin}/checkout/cancel?order=${encodeURIComponent(order.id)}`,
      }, `checkout:${order.id}`);
    },
    retrieve(id) {
      if (!sessionPattern.test(id ?? '')) throw Error('Invalid session');
      return request(`checkout/sessions/${encodeURIComponent(id)}`);
    },
  };
}

// Exact service-role RPC boundary: docs/phase3-db-contract.md.
export function createSupabaseDb({ url, serviceKey, fetchImpl = fetch, env = process.env, production = false }) {
  if (!production) testOnly(env);
  let parsed;
  try { parsed = new URL(url); } catch { throw Error('Invalid Supabase URL'); }
  const localHttp = parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname);
  const allowLocal = !production || env.NODE_ENV !== 'production';
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/' ||
      !(parsed.protocol === 'https:' || (allowLocal && localHttp))) throw Error('Invalid Supabase URL');
  if (typeof serviceKey !== 'string' || !serviceKey) throw Error('Supabase service key required');
  return {
    async rpc(operation, input) {
      const response = await fetchImpl(`${parsed.origin}/rest/v1/rpc/${operation}`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw Error('Database operation failed');
      const result = await response.json();
      if (!result || typeof result !== 'object' || result.error || (Array.isArray(result) && operation !== 'p3_outbox_claim')) throw Error('Invalid database result');
      return result;
    },
  };
}

export function deriveIntakeToken(orderId, tokenSecret) {
  if (typeof tokenSecret !== 'string' || Buffer.byteLength(tokenSecret) < 32) throw Error('Stable invitation secret of at least 32 bytes required');
  return createHmac('sha256', tokenSecret).update(`intake:v1:${orderId}`).digest('hex');
}

export function createStripePayments({ stripe, db, webhookSecret, tokenSecret, origin = 'http://127.0.0.1:5173', env = process.env, production = false, livemode = false }) {
  if (!production) {
    testOnly(env);
    if (livemode) throw Error('Stripe live/test environment mismatch');
    if (!LOCAL_DEV_ORIGINS.includes(origin)) throw Error('Fixed local origin required');
  } else if (env.NODE_ENV === 'production') {
    if (!PRODUCTION_WEB_ORIGINS.includes(origin)) throw Error('Production website origin is not allowed');
  } else if (![...LOCAL_DEV_ORIGINS, ...PRODUCTION_WEB_ORIGINS].includes(origin)) throw Error('Origin is not allowed');
  if (typeof webhookSecret !== 'string' || !webhookSecret.startsWith('whsec_') || webhookSecret.length < 12) throw Error('Webhook secret required');
  deriveIntakeToken('configuration-check', tokenSecret);
  const sessionPrefix = livemode ? 'cs_live_' : 'cs_test_';
  const corsOrigins = production && env.NODE_ENV === 'production' ? PRODUCTION_WEB_ORIGINS : [origin];
  async function authorized(id, token) {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(id) || !/^[a-f0-9]{64}$/.test(token ?? '')) throw Error('Unauthorized');
    const order = await db.rpc('p3_order_status', { p_order_id: id, p_token_hash: hash(token) });
    if (order.order_id !== id) throw Error('Unauthorized');
    return order;
  }
  function match(session, order) {
    if (session.livemode !== livemode || typeof session.id !== 'string' || !session.id.startsWith(sessionPrefix)) throw Error('Stripe live/test environment mismatch');
    if (session.mode !== 'payment' || session.id !== order.sessionId ||
        session.metadata?.order_id !== order.id || session.client_reference_id !== order.id ||
        session.amount_total !== order.amount || session.currency !== 'usd' || order.currency !== 'usd' ||
        !Object.hasOwn(packages, order.packageId) || order.amount !== packages[order.packageId]) throw Error('Payment mismatch');
  }
  return {
    origin,
    corsOrigins,
    async checkout({ packageId, email, requestId, browserOrigin }) {
      if (!Object.hasOwn(packages, packageId) || typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
          !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(requestId ?? '')) throw Error('Invalid checkout');
      email = email.trim().toLowerCase();
      const prepared = await db.rpc('p3_checkout_prepare', { p_package_id: packageId, p_email: email, p_request_id: requestId });
      const order = { id: prepared.order_id, packageId: prepared.package_id, email: prepared.email, amount: prepared.amount, currency: prepared.currency, sessionId: prepared.stripe_session_id };
      if (order.packageId !== packageId || order.email !== email || order.amount !== packages[packageId] || order.currency !== 'usd' || !/^[a-zA-Z0-9-]{1,80}$/.test(order.id ?? '')) throw Error('Invalid reservation');
      const age = Date.now() - Date.parse(prepared.created_at);
      if (!order.sessionId && (!Number.isFinite(age) || age < -60000 || age > 23 * 3600000)) throw Error('Checkout requires operator reconciliation');
      const returnTo = typeof browserOrigin === 'string' && (browserOrigin === origin || PRODUCTION_WEB_ORIGINS.includes(browserOrigin) || (production && env.NODE_ENV === 'production' && isAllowedPreviewOrigin(browserOrigin))) ? browserOrigin : origin;
      const session = order.sessionId ? await stripe.retrieve(order.sessionId) : await stripe.create(order, returnTo);
      match(session, { ...order, sessionId: session.id });
      const checkoutUrl = new URL(session.url);
      if (checkoutUrl.origin !== 'https://checkout.stripe.com' || checkoutUrl.username || checkoutUrl.password) throw Error('Unsafe checkout redirect');
      await db.rpc('p3_checkout_attach', { p_order_id: order.id, p_session_id: session.id, p_checkout_url: checkoutUrl.href, p_token_hash: hash(deriveIntakeToken(order.id, tokenSecret)) });
      return { id: order.id, sessionId: session.id, url: checkoutUrl.href, token: deriveIntakeToken(order.id, tokenSecret), mode: livemode ? 'stripe-live' : 'stripe-test' };
    },
    async webhook(raw, signature) {
      verify(raw, signature, webhookSecret);
      const event = JSON.parse(raw);
      if (event.livemode !== livemode) throw Error('Stripe live/test environment mismatch');
      if (!/^evt_[A-Za-z0-9_]+$/.test(event.id ?? '')) throw Error('Invalid test event');
      const types = { 'checkout.session.completed': 'completed', 'checkout.session.async_payment_succeeded': 'completed', 'checkout.session.async_payment_failed': 'failed', 'checkout.session.expired': 'expired' };
      if (!Object.hasOwn(types, event.type)) return { ignored: true };
      const incoming = event.data?.object;
      const session = await stripe.retrieve(incoming?.id);
      // DB validates immutable order/session/amount atomically; no unrestricted lookup RPC.
      const order = { id: session.metadata?.order_id, sessionId: session.id, amount: session.amount_total, currency: session.currency, packageId: Object.keys(packages).find(key => packages[key] === session.amount_total) };
      match(session, order);
      if (incoming?.metadata?.order_id !== order.id || incoming.amount_total !== order.amount || incoming.currency !== 'usd') throw Error('Event mismatch');
      if (event.type === 'checkout.session.expired' && session.status !== 'expired' && session.payment_status !== 'paid') throw Error('Session not expired');
      if (session.payment_status === 'paid' && session.status !== 'complete') throw Error('Incomplete paid session');
      if (session.payment_status === 'paid' && !/^pi_[A-Za-z0-9_]+$/.test(session.payment_intent ?? '')) throw Error('Missing payment intent');
      return db.rpc('p3_payment_event', { p_event_id: event.id, p_event_type: event.type, p_order_id: order.id, p_session_id: session.id, p_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null, p_amount: session.amount_total, p_currency: session.currency, p_payment_status: session.payment_status, p_livemode: session.livemode, p_payload_fingerprint: hash(raw), p_token_hash: session.payment_status === 'paid' ? hash(deriveIntakeToken(order.id, tokenSecret)) : null });
    },
    async status(id, token) {
      const order = await authorized(id, token);
      // Browser redirects never mutate payment state; only verified webhook RPC does.
      return { id: order.order_id, status: order.status, packageId: order.package_id, intakeReceived: order.intake_received };
    },
    async intake(id, token, input) {
      await authorized(id, token);
      for (const key of ['businessName', 'requirements']) if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > (key === 'businessName' ? 200 : 20000)) throw Error('Invalid intake');
      return db.rpc('p3_submit_intake', { p_order_id: id, p_token_hash: hash(token), p_business_name: input.businessName.trim(), p_requirements: input.requirements.trim() });
    },
  };
}
export const generateOrderToken = () => randomBytes(32).toString('hex');
