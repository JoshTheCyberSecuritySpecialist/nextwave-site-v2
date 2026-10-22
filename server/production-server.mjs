import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createStripe, createStripePayments, createSupabaseDb, LOCAL_DEV_ORIGINS, PRODUCTION_WEB_ORIGINS, assertStripeKeyMatchesMode, isAllowedPreviewOrigin } from './stripe-payments.mjs';

export const REQUIRED_PRODUCTION_ENV = Object.freeze([
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'PAYMENT_TOKEN_SECRET',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'APP_BASE_URL',
  'STRIPE_MODE',
]);

function rejectBrowserSecrets(env) {
  for (const name of Object.keys(env)) {
    if (!name.startsWith('VITE_') || !env[name]) continue;
    if (/SECRET|SERVICE_ROLE|WEBHOOK|TOKEN/i.test(name)) throw Error('Server secrets must not be placed in browser environment variables');
  }
  if (env.VITE_SUPABASE_ANON_KEY && env.VITE_SUPABASE_ANON_KEY === env.SUPABASE_SERVICE_ROLE_KEY) throw Error('Supabase service key must not be the browser anon key');
}

export function readProductionConfig(env = process.env) {
  rejectBrowserSecrets(env);
  const missing = REQUIRED_PRODUCTION_ENV.filter(name => typeof env[name] !== 'string' || env[name].length === 0);
  if (missing.length) throw Error(`Missing required environment variable: ${missing.join(', ')}`);
  const livemode = assertStripeKeyMatchesMode(env.STRIPE_SECRET_KEY, env.STRIPE_MODE);
  if (!env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_') || env.STRIPE_WEBHOOK_SECRET.length < 12) throw Error('Webhook secret required');
  if (Buffer.byteLength(env.PAYMENT_TOKEN_SECRET) < 32) throw Error('Stable invitation secret of at least 32 bytes required');
  let appUrl;
  try { appUrl = new URL(env.APP_BASE_URL); } catch { throw Error('APP_BASE_URL is not allowed'); }
  if (appUrl.username || appUrl.password || appUrl.search || appUrl.hash || appUrl.pathname !== '/') throw Error('APP_BASE_URL is not allowed');
  const origin = appUrl.origin;
  const production = env.NODE_ENV === 'production';
  if (production ? !PRODUCTION_WEB_ORIGINS.includes(origin) : !LOCAL_DEV_ORIGINS.includes(origin)) throw Error('APP_BASE_URL is not allowed');
  let supabase;
  try { supabase = new URL(env.SUPABASE_URL); } catch { throw Error('Invalid Supabase URL'); }
  const localHttp = supabase.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(supabase.hostname);
  if (supabase.username || supabase.password || supabase.search || supabase.hash || supabase.pathname !== '/') throw Error('Invalid Supabase URL');
  if (production ? supabase.protocol !== 'https:' : !(supabase.protocol === 'https:' || localHttp)) throw Error('Invalid Supabase URL');
  return { livemode, origin, corsOrigins: production ? PRODUCTION_WEB_ORIGINS : [origin] };
}

export function listenTarget(env = process.env) {
  const raw = env.PORT;
  const port = raw === undefined || raw === '' ? 8788 : Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid PORT');
  return { port, host: env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1' };
}

function hostAllowed(host, env) {
  if (typeof host !== 'string' || host.length === 0 || host.length > 255) return false;
  if (env.NODE_ENV === 'production') return /^[A-Za-z0-9.-]+(?::\d{1,5})?$/.test(host);
  return /^(127\.0\.0\.1|localhost)(?::\d{1,5})?$/.test(host);
}

export function productionServer({ payments, env = process.env }) {
  const corsOrigins = Array.isArray(payments.corsOrigins) && payments.corsOrigins.length ? payments.corsOrigins : [payments.origin];
  if (corsOrigins.some(origin => typeof origin !== 'string' || origin === '*')) throw Error('Origin is not allowed');
  const production = env.NODE_ENV === 'production';
  if (production ? !corsOrigins.every(origin => PRODUCTION_WEB_ORIGINS.includes(origin)) : !corsOrigins.every(origin => LOCAL_DEV_ORIGINS.includes(origin))) {
    throw Error(production ? 'Production website origin is not allowed' : 'Local origin is not allowed');
  }
  const server = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    let sent = false;
    let webhook = false;
    const reply = (status, body) => {
      if (sent) return;
      sent = true;
      res.writeHead(status);
      res.end(body === undefined ? undefined : JSON.stringify(body));
    };
    if (!hostAllowed(req.headers.host, env)) return reply(403, { error: 'Host rejected' });
    const originHeader = req.headers.origin;
    const previewAllowed = production && typeof originHeader === 'string' && isAllowedPreviewOrigin(originHeader);
    if (Array.isArray(originHeader) || (typeof originHeader === 'string' && !corsOrigins.includes(originHeader) && !previewAllowed)) {
      req.resume();
      return reply(403, { error: 'Origin rejected' });
    }
    if (typeof originHeader === 'string') {
      res.setHeader('Access-Control-Allow-Origin', originHeader);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    let pathname;
    try { pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname.replace(/\/{2,}/g, '/'); }
    catch { return reply(400, { error: 'Request rejected' }); }
    if (pathname === '/api/mock' || pathname.startsWith('/api/mock/')) {
      req.resume();
      return reply(404, { error: 'Not found' });
    }
    if (req.method === 'GET' && pathname === '/health') return reply(200, { ok: true });
    if (req.method === 'OPTIONS') {
      req.resume();
      if (typeof originHeader !== 'string') return reply(403, { error: 'Origin required' });
      return reply(204);
    }
    webhook = req.method === 'POST' && pathname === '/api/webhook';
    if (pathname.startsWith('/api/') && !webhook && typeof originHeader !== 'string') {
      req.resume();
      return reply(403, { error: 'Origin required' });
    }
    try {
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 65536) return reply(413, { error: 'Body too large' });
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks);
      const token = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization ?? '')?.[1];
      let result;
      if (webhook) {
        if (typeof req.headers['stripe-signature'] !== 'string') throw Error('Invalid webhook signature');
        result = await payments.webhook(raw, req.headers['stripe-signature']);
      } else if (req.method === 'POST' && pathname === '/api/checkout') {
        const input = JSON.parse(raw.toString('utf8'));
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Invalid checkout');
        result = await payments.checkout({ packageId: input.packageId, email: input.email, requestId: input.requestId, browserOrigin: originHeader });
      } else {
        const match = /^\/api\/orders\/([a-zA-Z0-9-]{1,80})(\/intake)?$/.exec(pathname);
        if (match && req.method === 'GET' && !match[2]) result = await payments.status(match[1], token);
        else if (match && req.method === 'POST' && match[2]) {
          const input = JSON.parse(raw.toString('utf8'));
          if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Invalid intake');
          result = await payments.intake(match[1], token, input);
        } else return reply(404, { error: 'Not found' });
      }
      reply(200, result);
    } catch {
      reply(webhook ? 503 : 400, { error: 'Request rejected; retry with the same request ID.' });
    }
  });
  server.requestTimeout = 20000;
  server.headersTimeout = 10000;
  const listen = server.listen.bind(server);
  server.listen = (port = 8788, host = production ? '0.0.0.0' : '127.0.0.1', ...args) => {
    if (production) {
      if (host !== '0.0.0.0') throw Error('Production must bind 0.0.0.0');
    } else if (host !== '127.0.0.1') throw Error('Loopback binding required');
    return listen(port, host, ...args);
  };
  return server;
}

export function createProductionApp(env = process.env) {
  const config = readProductionConfig(env);
  const stripe = createStripe({ secretKey: env.STRIPE_SECRET_KEY, env, production: true, livemode: config.livemode });
  const db = createSupabaseDb({ url: env.SUPABASE_URL, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY, env, production: true });
  const payments = createStripePayments({
    stripe, db, webhookSecret: env.STRIPE_WEBHOOK_SECRET, tokenSecret: env.PAYMENT_TOKEN_SECRET,
    origin: config.origin, env, production: true, livemode: config.livemode,
  });
  return productionServer({ payments, env });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const server = createProductionApp(process.env);
    const { port, host } = listenTarget(process.env);
    server.on('error', () => {
      console.error('API failed to start');
      process.exit(1);
    });
    server.listen(port, host, () => console.log(`API listening on ${host}:${port}`));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Startup failed');
    process.exit(1);
  }
}
