import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  createGuestBooking,
  formatBookingTime,
  groupSlots,
  guestBookingError,
  loadOpenSlots,
  loadPublicBookingPage,
  submissionKey,
  type BookingReceipt,
  type BookingSlot,
  type PublicBookingPage,
  type PublicService,
} from '../lib/public-booking';

const fieldClass = 'mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-[#0A0F1E] px-3 text-white';

function paint(value: string | null) {
  return value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : undefined;
}

export default function Book() {
  const { slug = '' } = useParams();
  const [page, setPage] = useState<PublicBookingPage | null>(null);
  const [missing, setMissing] = useState(false);
  const [service, setService] = useState<PublicService | null>(null);
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [slot, setSlot] = useState<BookingSlot | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<BookingReceipt | null>(null);

  useEffect(() => {
    let stopped = false;
    setLoading(true);
    setError('');
    setMissing(false);
    loadPublicBookingPage(slug)
      .then(next => {
        if (stopped) return;
        setPage(next);
        setMissing(!next);
        if (next?.services.length === 1) setService(next.services[0]);
      })
      .catch(reason => { if (!stopped) setError(guestBookingError(reason, 'This booking page could not be loaded.')); })
      .finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; };
  }, [slug]);

  useEffect(() => {
    if (!page || !service) return;
    let stopped = false;
    setSlotsLoading(true);
    setError('');
    loadOpenSlots(page.slug, service.id)
      .then(next => { if (!stopped) setSlots(next); })
      .catch(reason => { if (!stopped) setError(guestBookingError(reason, 'Open times could not be loaded.')); })
      .finally(() => { if (!stopped) setSlotsLoading(false); });
    return () => { stopped = true; };
  }, [page, service]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!page || !service || !slot) return;
    setSaving(true);
    setError('');
    const key = submissionKey(`${page.slug}:${service.id}:${slot.starts_at}:${email.trim().toLowerCase()}`);
    try {
      const next = await createGuestBooking({
        slug: page.slug,
        serviceId: service.id,
        startsAt: slot.starts_at,
        guestName: name,
        guestEmail: email,
        guestPhone: phone,
        idempotencyKey: key,
      });
      setReceipt(next);
    } catch (reason) {
      setError(guestBookingError(reason, 'The appointment could not be booked.'));
      setSlotsLoading(true);
      loadOpenSlots(page.slug, service.id)
        .then(setSlots)
        .catch(() => undefined)
        .finally(() => setSlotsLoading(false));
    } finally {
      setSaving(false);
    }
  }

  const groups = page ? groupSlots(slots, page.timezone) : [];

  return (
    <div className="min-h-screen bg-[#0A0F1E] px-4 py-10 text-white">
      <main className="mx-auto max-w-2xl">
        {loading && <div className="h-64 animate-pulse rounded-xl bg-[#0d1424]" />}
        {error && <p role="alert" className="mb-4 text-red-200">{error}</p>}
        {!loading && missing && <h1 className="text-3xl font-bold">This booking page is not available.</h1>}
        {!loading && page && (
          <article className="rounded-xl border bg-[#0d1424] p-5 sm:p-6" style={{ borderColor: paint(page.brand_accent) ?? '#1f2937' }}>
            <h1 className="text-3xl font-bold" style={{ color: paint(page.brand_primary) }}>{page.business_name}</h1>
            {page.booking_intro && <p className="mt-3 whitespace-pre-wrap text-gray-200">{page.booking_intro}</p>}
            <p className="mt-3 text-sm text-gray-400">{page.timezone}</p>
            {receipt ? (
              <section className="mt-8" aria-live="polite">
                <h2 className="text-xl font-semibold">Appointment booked</h2>
                <p className="mt-2 text-gray-200">
                  {receipt.service_name} with {receipt.business_name} on {formatBookingTime(receipt.starts_at, receipt.timezone, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.
                </p>
                <p className="mt-3 text-sm text-gray-400">
                  {receipt.confirmation_queued
                    ? 'A confirmation email is queued for the address you entered. Keep this page until it arrives.'
                    : 'Save this confirmation. This page does not send an email.'}
                </p>
              </section>
            ) : (
              <>
                <h2 className="mt-8 text-lg font-semibold">Services</h2>
                {page.services.length === 0 ? <p className="mt-2 text-gray-300">No services have been published.</p> : (
                  <ul className="mt-3 space-y-2">
                    {page.services.map(item => (
                      <li key={item.id}>
                        <button
                          type="button"
                          aria-pressed={service?.id === item.id}
                          onClick={() => { setService(item); setSlot(null); }}
                          className={`min-h-11 w-full rounded-lg border px-4 py-3 text-left ${service?.id === item.id ? 'border-[#2283B8] bg-[#2283B8]/20' : 'border-gray-700'}`}
                        >
                          <span className="font-medium">{item.name}</span>
                          <span className="mt-1 block text-sm text-gray-400">{item.duration_minutes} minutes</span>
                          {item.description && <span className="mt-1 block text-sm text-gray-300">{item.description}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {service && (
                  <section className="mt-8">
                    <h2 className="text-lg font-semibold">Open times</h2>
                    {slotsLoading && <div className="mt-3 h-24 animate-pulse rounded-lg bg-[#0A0F1E]" />}
                    {!slotsLoading && groups.length === 0 && <p className="mt-2 text-gray-300">No open times in the next two weeks.</p>}
                    <div className="mt-3 space-y-4">
                      {groups.map(([label, times]) => (
                        <section key={label}>
                          <h3 className="text-sm font-semibold text-gray-300">{label}</h3>
                          <ul className="mt-2 flex flex-wrap gap-2">
                            {times.map(time => (
                              <li key={time.starts_at}>
                                <button
                                  type="button"
                                  aria-pressed={slot?.starts_at === time.starts_at}
                                  onClick={() => setSlot(time)}
                                  className={`min-h-11 rounded-lg border px-3 ${slot?.starts_at === time.starts_at ? 'border-[#2283B8] bg-[#2283B8] text-white' : 'border-gray-700'}`}
                                >
                                  {formatBookingTime(time.starts_at, page.timezone, { hour: 'numeric', minute: '2-digit' })}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </section>
                      ))}
                    </div>
                  </section>
                )}
                {service && slot && (
                  <form className="mt-8 space-y-4" onSubmit={onSubmit}>
                    <h2 className="text-lg font-semibold">Your details</h2>
                    <label className="block text-sm text-gray-300">Name
                      <input required maxLength={200} autoComplete="name" value={name} onChange={event => setName(event.target.value)} className={fieldClass} />
                    </label>
                    <label className="block text-sm text-gray-300">Email
                      <input required type="email" maxLength={320} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className={fieldClass} />
                    </label>
                    <label className="block text-sm text-gray-300">Phone
                      <input required maxLength={40} autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} className={fieldClass} />
                    </label>
                    <button type="submit" disabled={saving} className="min-h-11 rounded-lg bg-[#2283B8] px-4 font-semibold disabled:opacity-50">
                      {saving ? 'Booking…' : 'Book appointment'}
                    </button>
                  </form>
                )}
                {page.policies && (
                  <>
                    <h2 className="mt-8 text-lg font-semibold">Policies</h2>
                    <p className="mt-2 whitespace-pre-wrap text-gray-200">{page.policies}</p>
                  </>
                )}
              </>
            )}
          </article>
        )}
      </main>
    </div>
  );
}
