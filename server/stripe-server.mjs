import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createStripe, createStripePayments, createSupabaseDb, testOnly } from './stripe-payments.mjs';

export function stripeServer({ payments, env = process.env }) {
  testOnly(env);
  const server = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const reply = (status, body) => { res.writeHead(status); res.end(JSON.stringify(body)); };
    if (req.headers.origin && req.headers.origin !== payments.origin) return reply(403, { error: 'Origin rejected' });
    if (req.headers.host && !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host)) return reply(403, { error: 'Host rejected' });
    try {
      const url = new URL(req.url, payments.origin);
      const webhook = req.method === 'POST' && url.pathname === '/api/webhook';
      if (req.method === 'POST' && !webhook && req.headers.origin !== payments.origin) return reply(403, { error: 'Origin required' });
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 65536) { reply(413, { error: 'Body too large' }); return; }
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks);
      const token = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization ?? '')?.[1];
      let result;
      if (webhook) result = await payments.webhook(raw, req.headers['stripe-signature']);
      else if (req.method === 'POST' && url.pathname === '/api/checkout') result = await payments.checkout({ ...JSON.parse(raw.toString('utf8')), token });
      else {
        const match = /^\/api\/orders\/([a-zA-Z0-9-]{1,80})(\/intake)?$/.exec(url.pathname);
        if (match && req.method === 'GET' && !match[2]) result = await payments.status(match[1], token);
        else if (match && req.method === 'POST' && match[2]) result = await payments.intake(match[1], token, JSON.parse(raw.toString('utf8')));
        else return reply(404, { error: 'Not found' });
      }
      reply(200, result);
    } catch {
      // Non-2xx permits Stripe retry after transient DB/Stripe failures. No secrets in logs/responses.
      reply(req.url === '/api/webhook' ? 503 : 400, { error: 'Request rejected; retry with the same request ID.' });
    }
  });
  server.requestTimeout = 20000;
  server.headersTimeout = 10000;
  const listen = server.listen.bind(server);
  server.listen = (port = 8788, host = '127.0.0.1', ...args) => {
    if (host !== '127.0.0.1') throw Error('Loopback binding required');
    return listen(port, host, ...args);
  };
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  testOnly();
  const stripe = createStripe({ secretKey: process.env.STRIPE_SECRET_KEY });
  const db = createSupabaseDb({ url: process.env.SUPABASE_URL, serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY });
  const payments = createStripePayments({ stripe, db, webhookSecret: process.env.STRIPE_WEBHOOK_SECRET, tokenSecret: process.env.PAYMENT_TOKEN_SECRET });
  stripeServer({ payments }).listen(8788, '127.0.0.1');
}
