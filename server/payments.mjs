import { createHmac, timingSafeEqual, randomUUID, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const packages = Object.freeze({ 'booking-only': 79900, 'website-crm': 149900 });
function signedPayload(body, timestamp) {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8');
  return Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), payload]);
}
export function sign(body, secret, timestamp = Math.floor(Date.now() / 1000)) {
  return `t=${timestamp},v1=${createHmac('sha256', secret).update(signedPayload(body, timestamp)).digest('hex')}`;
}
export function verify(body, header, secret) {
  const parts = String(header).split(',');
  const timestamp = Number(parts.find(p => p.startsWith('t='))?.slice(2));
  if (!Number.isInteger(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) throw Error('Invalid webhook timestamp');
  const expected = createHmac('sha256', secret).update(signedPayload(body, timestamp)).digest();
  const valid = parts.filter(p => p.startsWith('v1=')).some(p => {
    const received = Buffer.from(p.slice(3), 'hex');
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
  if (!valid) throw Error('Invalid webhook signature');
}

// Single-process local mock store only. Production requires transactional SQL and a real Stripe adapter.
export function createPayments({ file, secret }) {
  let db;
  try { db = JSON.parse(readFileSync(file, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; db = { orders: [], events: [], jobs: [], contacts: [], projects: [] }; }
  function save() {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(`${file}.tmp`, JSON.stringify(db), { mode: 0o600 });
    renameSync(`${file}.tmp`, file);
  }
  function authorized(id, token) {
    const order = db.orders.find(o => o.id === id);
    if (!order || typeof token !== 'string' || token.length !== order.token.length || !timingSafeEqual(Buffer.from(token), Buffer.from(order.token))) throw Error('Unauthorized');
    return order;
  }
  return {
    checkout({ packageId, email, requestId }) {
      if (!Object.hasOwn(packages, packageId) || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) throw Error('Invalid checkout');
      const old = db.orders.find(o => o.requestId === requestId);
      if (old && (old.email !== email || old.packageId !== packageId)) throw Error('Idempotency conflict');
      const order = old ?? { id: randomUUID(), sessionId: `cs_mock_${randomUUID()}`, token: randomBytes(32).toString('hex'), requestId, packageId, email, amount: packages[packageId], currency: 'usd', status: 'pending' };
      if (!old) { db.orders.push(order); save(); }
      return { id: order.id, token: order.token, sessionId: order.sessionId, amount: order.amount, mode: 'mock' };
    },
    webhook(raw, signature) {
      verify(raw, signature, secret);
      const event = JSON.parse(raw);
      if (event.livemode !== false || typeof event.id !== 'string') throw Error('Invalid mock event');
      if (db.events.includes(event.id)) return { duplicate: true };
      if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) return { ignored: true };
      const session = event.data?.object;
      const order = db.orders.find(o => o.sessionId === session?.id);
      if (!order || session.amount_total !== order.amount || session.currency !== order.currency || session.metadata?.order_id !== order.id) throw Error('Payment mismatch');
      if (session.payment_status !== 'paid') return { unpaid: true };
      if (order.status === 'pending') {
        order.status = 'paid';
        db.jobs.push({ id: `confirmation:${order.id}`, orderId: order.id, type: 'payment_confirmation', status: 'queued' });
      }
      db.events.push(event.id); save();
      return { accepted: true };
    },
    status(id, token) { const o = authorized(id, token); return { id: o.id, status: o.status, packageId: o.packageId, amount: o.amount, confirmation: 'queued locally; not sent' }; },
    intake(id, token, input) {
      const order = authorized(id, token);
      if (!['paid', 'intake_received'].includes(order.status)) throw Error('Payment not confirmed');
      for (const field of ['businessName', 'requirements']) if (typeof input[field] !== 'string' || !input[field].trim() || input[field].length > 4000) throw Error('Invalid intake');
      if (order.status === 'intake_received') return { accepted: true, duplicate: true };
      order.intake = { businessName: input.businessName.trim(), requirements: input.requirements.trim() };
      order.status = 'intake_received';
      let contact = db.contacts.find(c => c.email === order.email);
      if (!contact) { contact = { id: randomUUID(), email: order.email }; db.contacts.push(contact); }
      db.projects.push({ id: randomUUID(), orderId: id, contactId: contact.id, status: 'ready_for_review', packageId: order.packageId });
      db.jobs.push({ id: `onboarding:${id}`, orderId: id, type: 'crm_sync_and_kickoff', status: 'queued' });
      save(); return { accepted: true };
    },
  };
}
