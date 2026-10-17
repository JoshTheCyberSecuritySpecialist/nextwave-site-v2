import { useState } from 'react';
import { bookingPackage, websiteCrmPackage } from '../data/offers';

type Order = { id: string; token: string; sessionId: string };
export default function Checkout() {
  const [order, setOrder] = useState<Order>();
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function request(path: string, body?: object) {
    const response = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(order ? { Authorization: `Bearer ${order.token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'Request failed');
    return data;
  }
  async function act(work: () => Promise<void>) {
    setBusy(true); setError('');
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); } finally { setBusy(false); }
  }
  if (!import.meta.env.DEV) return <main className="p-10">Checkout is not enabled. Contact Next Wave to confirm scope and payment arrangements.</main>;
  return <main className="max-w-2xl mx-auto p-10 space-y-6">
    <h1 className="text-3xl font-bold">Local payment and onboarding demonstration</h1>
    <p>MOCK ONLY — no Stripe transaction, charge or email. Hosting is not enrolled. $149/month after 30 days remains subject to final terms and separate consent.</p>
    {!order && <form className="space-y-4" onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); void act(async () => { const result = await request('/api/checkout', { packageId: form.get('packageId'), email: form.get('email'), requestId: crypto.randomUUID() }); setOrder(result); setStatus('pending'); }); }}>
      <label className="block">Package <select name="packageId" className="text-black p-2"><option value={bookingPackage.id}>{bookingPackage.name} — $799</option><option value={websiteCrmPackage.id}>{websiteCrmPackage.name} — $1,499</option></select></label>
      <label className="block">Email <input className="text-black p-2" name="email" type="email" required maxLength={254} /></label>
      <button disabled={busy} className="border p-3">Start mock checkout</button>
    </form>}
    {order && <><p role="status">Order state: {status}. No payment is inferred from a redirect.</p>
      {status === 'pending' && <button disabled={busy} className="border p-3" onClick={() => void act(async () => { await request('/api/mock/complete', { id: order.id, sessionId: order.sessionId }); const result = await request(`/api/orders/${order.id}`); setStatus(result.status); })}>Simulate signed paid webhook</button>}
      {status === 'paid' && <form className="space-y-4" onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); void act(async () => { await request(`/api/orders/${order.id}/intake`, { businessName: form.get('businessName'), requirements: form.get('requirements') }); const result = await request(`/api/orders/${order.id}`); setStatus(result.status); }); }}>
        <label className="block">Business name <input name="businessName" className="text-black p-2" required maxLength={4000} /></label>
        <label className="block">Services, availability and project requirements <textarea name="requirements" className="text-black p-2" required maxLength={4000} /></label>
        <p>Do not enter passwords or credentials.</p><button disabled={busy} className="border p-3">Submit intake</button>
      </form>}
      {status === 'intake_received' && <p>Intake saved. Local customer record and project created for review. Confirmation and CRM/kickoff jobs queued locally; nothing sent externally.</p>}
    </>}
    {error && <p role="alert">{error}</p>}
  </main>;
}
