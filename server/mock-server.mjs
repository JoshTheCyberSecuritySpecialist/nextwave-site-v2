import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createPayments, sign } from './payments.mjs';

export function mockServer({ file = '.local/payments.json' } = {}) {
  const secret = randomBytes(32).toString('hex');
  const payments = createPayments({ file, secret });
  return createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    // No CORS: browser access is through the same-origin local Vite proxy only.
    if (req.headers.origin && !['http://localhost:5173', 'http://127.0.0.1:5173'].includes(req.headers.origin)) { res.writeHead(403); res.end('{}'); return; }
    try {
      let raw = '';
      for await (const chunk of req) { raw += chunk; if (raw.length > 16384) throw Error('Request too large'); }
      const url = new URL(req.url, 'http://localhost');
      const token = req.headers.authorization?.replace(/^Bearer /, '');
      let result;
      if (req.method === 'POST' && url.pathname === '/api/checkout') result = payments.checkout(JSON.parse(raw));
      else if (req.method === 'POST' && url.pathname === '/api/webhook') result = payments.webhook(raw, req.headers['stripe-signature']);
      else if (req.method === 'POST' && url.pathname === '/api/mock/complete') {
        const { id, sessionId } = JSON.parse(raw);
        const order = payments.status(id, token);
        const event = JSON.stringify({ id: `evt_mock_${id}`, livemode: false, type: 'checkout.session.completed', data: { object: { id: sessionId, amount_total: order.amount, currency: 'usd', payment_status: 'paid', metadata: { order_id: id } } } });
        result = payments.webhook(event, sign(event, secret));
      } else if (url.pathname.startsWith('/api/orders/')) {
        const parts = url.pathname.split('/');
        if (req.method === 'GET' && parts.length === 4) result = payments.status(parts[3], token);
        else if (req.method === 'POST' && parts[4] === 'intake') result = payments.intake(parts[3], token, JSON.parse(raw));
      }
      if (!result) { res.writeHead(404); result = { error: 'Not found' }; }
      res.end(JSON.stringify(result));
    } catch { res.writeHead(400); res.end(JSON.stringify({ error: 'Request rejected; check authorization, input and payment state.' })); }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  mockServer().listen(8787, '127.0.0.1', () => console.log('MOCK ONLY payment backend: http://127.0.0.1:8787'));
}
