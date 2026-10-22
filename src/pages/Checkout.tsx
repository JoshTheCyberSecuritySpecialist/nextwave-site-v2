import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { bookingPackage, websiteCrmPackage } from '../data/offers';
import { apiUrl, checkoutAvailability, checkoutIsShown, checkoutPath, checkoutPhase } from '../lib/payments-client.mjs';

type Order = { id: string; token: string };
type ApiResult = { error?: string; url?: string; mode?: string; id?: string; token?: string; status?: string; packageId?: string };
const apiEnv = { dev: import.meta.env.DEV, configured: import.meta.env.VITE_API_BASE_URL };
const availability = checkoutAvailability({ dev: import.meta.env.DEV, configured: import.meta.env.VITE_CHECKOUT_MODE });
const packages = [bookingPackage, websiteCrmPackage] as const;
const terminalStatuses = new Set(['paid', 'intake_received', 'fulfilled', 'refunded', 'failed', 'expired']);
const fieldClass = 'mt-2 w-full rounded-lg border border-[#2283B8]/50 bg-[#0A0F1E] px-3 py-3 text-white';
const buttonClass = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-[#2283B8] px-5 py-3 text-base font-semibold text-white hover:bg-[#1b6d99] disabled:cursor-not-allowed disabled:opacity-60';

function knownPackage(id: string | null | undefined) {
  return packages.find(item => item.id === id);
}

function readStoredOrder(): Order | undefined {
  try {
    const stored = JSON.parse(sessionStorage.getItem('nextwave-test-order') || 'null') as Order | null;
    if (stored && /^[a-zA-Z0-9-]{1,80}$/.test(stored.id) && /^[a-f0-9]{64}$/.test(stored.token)) return { id: stored.id, token: stored.token };
  } catch { /* Ignore unavailable session storage. */ }
  return undefined;
}

async function request(path: string, body?: object, credential?: string) {
  let response: Response;
  try {
    response = await fetch(apiUrl(path, apiEnv), {
      method: body ? 'POST' : 'GET',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw Error('Could not reach the payment API from this website.');
  }
  const data = await response.json().catch(() => null) as ApiResult | null;
  if (!response.ok || !data || typeof data !== 'object') throw Error(data?.error || 'Request failed');
  return data;
}

function statusCopy(status: string, phase: string) {
  if (status === 'paid' || status === 'intake_received' || status === 'fulfilled') return 'Server confirmed this test payment.';
  if (status === 'failed') return 'Server confirmed the payment failed.';
  if (status === 'expired') return 'Server confirmed the checkout session expired. No payment was recorded.';
  if (status === 'refunded') return 'Server confirmed this payment was refunded.';
  if (phase === 'cancel') return 'You left checkout. No charge has been confirmed.';
  return 'Payment is not confirmed yet.';
}

export default function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const phase = checkoutPhase(location.pathname);
  const requested = new URLSearchParams(location.search).get('package');
  const returnOrderId = new URLSearchParams(location.search).get('order');
  const selected = knownPackage(requested) ?? (requested ? undefined : bookingPackage);
  const [order, setOrder] = useState<Order>();
  const [status, setStatus] = useState('');
  const [confirmedPackage, setConfirmedPackage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [unmatched, setUnmatched] = useState(false);
  const [checks, setChecks] = useState(0);
  const enabled = checkoutIsShown(availability);
  const purchased = knownPackage(confirmedPackage);

  useEffect(() => {
    if (!enabled || phase === 'review') return;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const hashId = fragment.get('order');
    const hashToken = fragment.get('token');
    if (hashId && hashToken && /^[a-zA-Z0-9-]{1,80}$/.test(hashId) && /^[a-f0-9]{64}$/.test(hashToken)) {
      const saved = { id: hashId, token: hashToken };
      sessionStorage.setItem('nextwave-test-order', JSON.stringify(saved));
      setOrder(saved);
      setUnmatched(false);
      window.history.replaceState(null, '', `${location.pathname}${location.search}`);
      return;
    }
    const stored = readStoredOrder();
    if (stored && (!returnOrderId || returnOrderId === stored.id)) {
      setOrder(stored);
      setUnmatched(false);
      return;
    }
    setOrder(undefined);
    setUnmatched(Boolean(returnOrderId));
  }, [enabled, phase, returnOrderId, location.pathname, location.search]);

  useEffect(() => {
    if (!enabled || !order || phase === 'review') return;
    let stopped = false;
    let timer = 0;
    let attempts = 0;
    const maxAttempts = phase === 'cancel' ? 1 : 8;
    setStatus('');
    setConfirmedPackage('');
    const run = async () => {
      attempts += 1;
      setBusy(true);
      try {
        const result = await request(`/api/orders/${order.id}`, undefined, order.token);
        if (stopped) return;
        const nextStatus = typeof result.status === 'string' ? result.status : 'unknown';
        setStatus(nextStatus);
        setConfirmedPackage(typeof result.packageId === 'string' ? result.packageId : '');
        setError('');
        if (!terminalStatuses.has(nextStatus) && attempts < maxAttempts) timer = window.setTimeout(() => { void run(); }, 3000);
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : 'Request failed');
      } finally {
        if (!stopped) setBusy(false);
      }
    };
    void run();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [enabled, order, phase, checks]);

  async function startCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const email = String(new FormData(event.currentTarget).get('email'));
    const packageId = selected.id;
    setBusy(true);
    setError('');
    try {
      let pending: { requestId?: string; packageId?: string; email?: string } | null;
      try { pending = JSON.parse(sessionStorage.getItem('nextwave-test-request') || 'null'); } catch { pending = null; }
      if (!pending || pending.packageId !== packageId || pending.email !== email || !pending.requestId) {
        pending = { requestId: crypto.randomUUID(), packageId, email };
        sessionStorage.setItem('nextwave-test-request', JSON.stringify(pending));
      }
      const result = await request('/api/checkout', { packageId, email, requestId: pending.requestId });
      if (typeof result.url !== 'string' || typeof result.id !== 'string' || result.mode !== 'stripe-test') throw Error('Unsafe checkout destination');
      const redirect = new URL(result.url);
      if (redirect.origin !== 'https://checkout.stripe.com' || redirect.username || redirect.password) throw Error('Unsafe checkout destination');
      if (typeof result.token !== 'string' || !/^[a-f0-9]{64}$/.test(result.token)) throw Error('Request failed');
      sessionStorage.setItem('nextwave-test-order', JSON.stringify({ id: result.id, token: result.token }));
      window.location.assign(redirect.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
      setBusy(false);
    }
  }

  async function submitIntake(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!order) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await request(`/api/orders/${order.id}/intake`, { businessName: form.get('businessName'), requirements: form.get('requirements') }, order.token);
      setStatus('intake_received');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  const step = phase === 'review' ? 1 : status === 'paid' || status === 'intake_received' ? 3 : 2;
  const steps = ['Package', 'Payment', 'Details'];

  return <div className="overflow-x-clip px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8">
    <div className="mx-auto max-w-5xl">
      <p className="text-sm font-semibold uppercase tracking-wide text-[#7dd3f5]">Booking</p>
      <ol className="mt-6 grid grid-cols-3 gap-2 text-sm sm:gap-4">
        {steps.map((label, index) => {
          const number = index + 1;
          const current = number === step;
          const done = number < step;
          return <li key={label} aria-current={current ? 'step' : undefined} className={`rounded-xl border px-3 py-3 ${current ? 'border-[#2BB0E8] bg-[#001F33]/80 text-white' : 'border-[#2283B8]/30 bg-[#001F33]/40 text-slate-300'}`}>
            <span className={`mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${done || current ? 'bg-[#2283B8] text-white' : 'bg-[#003B5C] text-slate-200'}`}>{number}</span>
            {label}
          </li>;
        })}
      </ol>
      <div className="mt-6">
        <Link to="/services" className="text-base text-[#7dd3f5] underline">Back to services</Link>
      </div>
      {availability === 'live-blocked' && <p className="mt-8 text-lg leading-8">Live checkout is not enabled. Real charges stay off until a verified Stripe test payment is confirmed.</p>}
      {enabled && phase === 'review' && <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{selected ? selected.name : 'Choose a package'}</h1>
          <p className="mt-4 text-base leading-7 text-slate-200">No recurring hosting plan is enrolled in this payment. Real charges stay off until a verified test payment is confirmed.</p>
          {!selected && <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link className={buttonClass} to={checkoutPath(bookingPackage.id)}>{bookingPackage.name}</Link>
            <Link className={buttonClass} to={checkoutPath(websiteCrmPackage.id)}>{websiteCrmPackage.name}</Link>
          </div>}
          {selected && <div className="mt-6 rounded-2xl border border-[#2283B8]/35 bg-[#001F33]/75 p-6 sm:p-8">
            <p className="text-4xl font-bold text-white">{selected.priceDisplay}</p>
            <p className="mt-4 text-base leading-7 text-slate-200">The server charges the catalog price for this package. This page sends the package id, email, and request id only.</p>
            <ul className="mt-6 space-y-3 text-base leading-7 text-slate-100">
              {selected.includes.map(item => <li key={item} className="flex gap-3"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2BB0E8]" /><span>{item}</span></li>)}
            </ul>
            {selected.id === websiteCrmPackage.id && <div className="mt-6 space-y-3 rounded-lg border border-[#2BB0E8]/50 bg-[#003B5C] p-4 text-base leading-7 text-slate-100">
              <p>{websiteCrmPackage.hostingIntro}</p>
              <p className="font-semibold text-white">{websiteCrmPackage.hostingThen}</p>
              <p>{websiteCrmPackage.billingNote}</p>
            </div>}
          </div>}
        </div>
        {selected && <form className="h-fit space-y-4 rounded-2xl border border-[#2283B8]/35 bg-[#001F33]/75 p-6 sm:p-8 lg:col-span-2" onSubmit={event => { void startCheckout(event); }}>
          <h2 className="text-xl font-bold text-white">Your details</h2>
          <p className="text-base leading-7 text-slate-200">After Stripe, this site checks the server for payment status. Intake opens only after the server reports the order as paid.</p>
          <label className="block text-slate-100">Package
            <select className={fieldClass} name="packageId" value={selected.id} onChange={event => { navigate(checkoutPath(event.target.value)); }}>
              <option value={bookingPackage.id}>{bookingPackage.name} — {bookingPackage.priceDisplay}</option>
              <option value={websiteCrmPackage.id}>{websiteCrmPackage.name} — {websiteCrmPackage.priceDisplay}</option>
            </select>
          </label>
          <label className="block text-slate-100">Email
            <input className={fieldClass} name="email" type="email" required maxLength={254} autoComplete="email" />
          </label>
          <button disabled={busy} className={`${buttonClass} w-full`}>Continue to secure checkout</button>
          <p className="text-sm leading-6 text-slate-300">Questions: <Link className="text-[#7dd3f5] underline" to="/contact">contact Next Wave</Link> or <a className="text-[#7dd3f5] underline" href="mailto:joshua@nextwavedigitalsolution.com">joshua@nextwavedigitalsolution.com</a>.</p>
        </form>}
      </section>}
      {enabled && phase !== 'review' && <section className="mt-8 max-w-3xl space-y-6 rounded-2xl border border-[#2283B8]/35 bg-[#001F33]/75 p-6 sm:p-8">
        <h1 className="text-3xl font-bold text-white sm:text-4xl">{phase === 'cancel' ? 'Checkout canceled' : !status || status === 'pending' ? 'Payment pending' : 'Payment status'}</h1>
        {phase === 'cancel' && <p className="text-base leading-7 text-slate-200">You left Stripe Checkout. This page does not, by itself, mean a card was charged or declined.</p>}
        {unmatched && <p role="status" className="text-base leading-7 text-slate-200">This browser does not have the checkout that matches the returned order. A redirect is not proof of payment.</p>}
        {order && <>
          <p role="status" className="text-base leading-7 text-slate-100">{status ? statusCopy(status, phase) : 'Checking the server for this order.'} A redirect is not proof of payment.</p>
          <p className="text-base text-slate-200">Order reference: {order.id}</p>
          {purchased && <p className="text-base leading-7 text-slate-100">{purchased.name} — {purchased.priceDisplay}. The price shown is the catalog price for the package id returned by the server.</p>}
          {confirmedPackage && !purchased && <p className="text-base text-slate-100">The server returned an unrecognized package.</p>}
          {!terminalStatuses.has(status) && <button disabled={busy} className={buttonClass} onClick={() => setChecks(value => value + 1)}>Check payment status</button>}
          {status === 'paid' && <form className="space-y-4" onSubmit={event => { void submitIntake(event); }}>
            <p className="text-base leading-7 text-slate-200">Payment is confirmed. Submit the project intake. Do not enter passwords or credentials.</p>
            <label className="block text-slate-100">Business name
              <input name="businessName" className={fieldClass} required maxLength={200} />
            </label>
            <label className="block text-slate-100">Project requirements
              <textarea name="requirements" className={fieldClass} required maxLength={4000} />
            </label>
            <button disabled={busy} className={buttonClass}>Submit intake</button>
          </form>}
          {status === 'intake_received' && <p className="text-base leading-7 text-slate-200">Intake accepted. Delivery status must be checked separately; queued does not mean sent.</p>}
        </>}
      </section>}
      {error && <p role="alert" className="mt-6 text-red-200">{error}</p>}
    </div>
  </div>;
}
