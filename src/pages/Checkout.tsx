import { useEffect, useState } from 'react';
import { bookingPackage, websiteCrmPackage } from '../data/offers';

type Order = { id: string; token: string };
export default function Checkout() {
  const [order, setOrder] = useState<Order>();
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const enabled = import.meta.env.DEV;
  useEffect(() => {
    if (!enabled) return;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const id = fragment.get('order');
    const token = fragment.get('token');
    if (id && token && /^[a-f0-9]{64}$/.test(token)) {
      setOrder({ id, token });
      window.history.replaceState(null, '', window.location.pathname);
    } else {
      try { const stored = sessionStorage.getItem('nextwave-test-order'); if (stored) setOrder(JSON.parse(stored)); } catch { /* Ignore unavailable session storage. */ }
    }
  }, [enabled]);
  async function request(path: string, body?: object, credential = order?.token) {
    const response = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'Request failed');
    return data;
  }
  async function act(work: () => Promise<void>) {
    setBusy(true); setError('');
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); } finally { setBusy(false); }
  }
  if (!enabled) return <main className="p-10">Checkout is not enabled. Contact Next Wave to confirm scope and payment arrangements.</main>;
  return <main className="max-w-2xl mx-auto p-10 space-y-6">
    <h1 className="text-3xl font-bold">Isolated Stripe test checkout</h1>
    <p>Development only. Use authorized Stripe test cards only. No recurring hosting plan is enrolled.</p>
    {!order && <form className="space-y-4" onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); void act(async () => {
      let pending;
      try { pending = JSON.parse(sessionStorage.getItem('nextwave-test-request') || 'null'); } catch { pending = null; }
      const packageId = String(form.get('packageId')); const email = String(form.get('email'));
      if (!pending || pending.packageId !== packageId || pending.email !== email) {
        const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
        pending = { requestId: crypto.randomUUID(), token, packageId, email };
        sessionStorage.setItem('nextwave-test-request', JSON.stringify(pending));
      }
      const result = await request('/api/checkout', { packageId, email, requestId: pending.requestId }, pending.token);
      const redirect = new URL(result.url);
      if (result.mode !== 'stripe-test' || redirect.origin !== 'https://checkout.stripe.com') throw Error('Unsafe checkout destination');
      const saved = { id: result.id, token: result.token || pending.token };
      sessionStorage.setItem('nextwave-test-order', JSON.stringify(saved));
      setOrder(saved);
      window.location.assign(redirect.href);
    }); }}>
      <label className="block">Package <select name="packageId" className="text-black p-2"><option value={bookingPackage.id}>{bookingPackage.name} — $799</option><option value={websiteCrmPackage.id}>{websiteCrmPackage.name} — $1,499</option></select></label>
      <label className="block">Email <input className="text-black p-2" name="email" type="email" required maxLength={254} /></label>
      <button disabled={busy} className="border p-3">Continue to Stripe test checkout</button>
    </form>}
    {order && <><p role="status">Server-confirmed order state: {status || 'not yet checked'}. A redirect is not proof of payment.</p>
      <button disabled={busy} className="border p-3" onClick={() => void act(async () => { const result = await request(`/api/orders/${order.id}`); setStatus(result.status); })}>Check payment status</button>
      {status === 'paid' && <form className="space-y-4" onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); void act(async () => { await request(`/api/orders/${order.id}/intake`, { businessName: form.get('businessName'), requirements: form.get('requirements') }); setStatus('intake_received'); }); }}>
        <label className="block">Business name <input name="businessName" className="text-black p-2" required maxLength={200} /></label>
        <label className="block">Project requirements <textarea name="requirements" className="text-black p-2" required maxLength={4000} /></label>
        <p>Do not enter passwords or credentials.</p><button disabled={busy} className="border p-3">Submit intake</button>
      </form>}
      {status === 'intake_received' && <p>Intake accepted. Delivery status must be checked separately; queued does not mean sent.</p>}
    </>}
    {error && <p role="alert">{error}</p>}
  </main>;
}
