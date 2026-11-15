import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { CrmSelection } from '../../lib/crm';
import {
  bookingError,
  formatClock,
  formatDuration,
  getBookingSettings,
  listServices,
  listWeeklyHours,
  weekdayLabel,
  type BookingService,
  type BookingSettings,
  type WeeklyWindow,
} from '../../lib/crm-booking';
import { getBookingPublication, setBookingPublished } from '../../lib/public-booking';

function paint(value: string | null) {
  return value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : undefined;
}

export default function BookingPreview() {
  const workspace = useOutletContext<CrmSelection>();
  const [settings, setSettings] = useState<BookingSettings | null>(null);
  const [services, setServices] = useState<BookingService[]>([]);
  const [windows, setWindows] = useState<WeeklyWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [published, setPublished] = useState<boolean | null>(null);
  const [publishError, setPublishError] = useState('');
  const [publishSaving, setPublishSaving] = useState(false);

  useEffect(() => {
    let stopped = false;
    setLoading(true);
    setError('');
    Promise.all([
      getBookingSettings(workspace.organizationId),
      listServices(workspace.organizationId),
      listWeeklyHours(workspace.organizationId),
    ]).then(([nextSettings, nextServices, schedule]) => {
      if (stopped) return;
      setSettings(nextSettings);
      setServices(nextServices.filter(service => service.active));
      setWindows(schedule.windows);
      if (!nextSettings) setError('Booking settings are not available for this workspace.');
    }).catch(reason => {
      if (!stopped) setError(bookingError(reason, 'The booking page could not be loaded.'));
    }).finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; };
  }, [workspace.organizationId]);

  useEffect(() => {
    let stopped = false;
    getBookingPublication(workspace.organizationId)
      .then(value => { if (!stopped) setPublished(value); })
      .catch(reason => { if (!stopped) setPublishError(bookingError(reason, 'Publishing could not be loaded.')); });
    return () => { stopped = true; };
  }, [workspace.organizationId]);

  async function onPublish() {
    if (published == null) return;
    setPublishSaving(true);
    setPublishError('');
    try {
      setPublished(await setBookingPublished(workspace.organizationId, !published));
    } catch (reason) {
      setPublishError(bookingError(reason, 'The booking page could not be updated.'));
    } finally {
      setPublishSaving(false);
    }
  }

  const openDays = [...windows].sort((left, right) => left.weekday - right.weekday);
  const ready = services.length > 0 && openDays.length > 0;
  const publicUrl = `${window.location.origin}/book/${workspace.slug}`;

  return (
    <section className="max-w-3xl">
      <h1 className="text-3xl font-bold">Booking page</h1>
      <p className="mt-2 text-gray-300">This preview uses the profile, services, and weekly hours saved in this workspace.</p>
      {publishError && <p role="alert" className="mt-4 text-red-200">{publishError}</p>}
      {!loading && published != null && (
        <section className="mt-6 rounded-xl border border-gray-800 bg-[#0d1424] p-5">
          <h2 className="text-lg font-semibold">{published ? 'Booking page is on' : 'Booking page is off'}</h2>
          <p className="mt-2 text-gray-300">
            {ready ? 'Guests can book only while this page is on.' : 'Add at least one service and weekly hours before turning the page on.'}
          </p>
          {published && <p className="mt-3 break-all text-sm text-[#7dd3f5]">{publicUrl}</p>}
          <button
            type="button"
            disabled={publishSaving || (!published && !ready)}
            onClick={() => { void onPublish(); }}
            className="mt-4 min-h-11 rounded-lg bg-[#2283B8] px-4 font-semibold disabled:opacity-50"
          >
            {publishSaving ? 'Saving…' : published ? 'Turn booking page off' : 'Turn booking page on'}
          </button>
        </section>
      )}
      {loading && <div className="mt-6 h-64 animate-pulse rounded-xl bg-[#0d1424]" />}
      {error && <p role="alert" className="mt-6 text-red-200">{error}</p>}
      {!loading && !error && settings && (
        <article
          className="mt-6 rounded-xl border bg-[#0d1424] p-5 sm:p-6"
          style={{ borderColor: paint(settings.brand_accent) ?? '#1f2937' }}
        >
          <h2 className="text-2xl font-bold" style={{ color: paint(settings.brand_primary) }}>{settings.business_name}</h2>
          {settings.booking_intro && <p className="mt-3 whitespace-pre-wrap text-gray-200">{settings.booking_intro}</p>}
          <dl className="mt-4 space-y-1 text-sm text-gray-300">
            {settings.location && <div>{settings.location}</div>}
            {settings.phone && <div>{settings.phone}</div>}
            {settings.email && <div>{settings.email}</div>}
            <div>{settings.timezone}</div>
          </dl>
          <h3 className="mt-8 text-lg font-semibold">Services</h3>
          {services.length === 0 ? <p className="mt-2 text-gray-300">No services have been published.</p> : (
            <ul className="mt-3 space-y-3">
              {services.map(service => (
                <li key={service.id} className="rounded-lg border border-gray-800 px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">{service.name}</p>
                    <p className="text-sm text-gray-400">{formatDuration(service.duration_minutes)}</p>
                  </div>
                  {service.description && <p className="mt-1 whitespace-pre-wrap text-sm text-gray-300">{service.description}</p>}
                </li>
              ))}
            </ul>
          )}
          <h3 className="mt-8 text-lg font-semibold">Weekly hours</h3>
          {openDays.length === 0 ? <p className="mt-2 text-gray-300">No weekly hours have been published.</p> : (
            <ul className="mt-3 space-y-2 text-sm">
              {openDays.map(window => (
                <li key={window.weekday} className="flex justify-between gap-4 rounded-lg border border-gray-800 px-4 py-2">
                  <span>{weekdayLabel(window.weekday)}</span>
                  <span>{formatClock(window.start_minute)} – {formatClock(window.end_minute)}</span>
                </li>
              ))}
            </ul>
          )}
          {settings.policies && (
            <>
              <h3 className="mt-8 text-lg font-semibold">Policies</h3>
              <p className="mt-2 whitespace-pre-wrap text-gray-200">{settings.policies}</p>
            </>
          )}
        </article>
      )}
    </section>
  );
}
