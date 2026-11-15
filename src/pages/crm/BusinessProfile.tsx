import { FormEvent, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { CrmSelection } from '../../lib/crm';
import { bookingError, bookingTimezones, getBookingSettings, updateBookingSettings, type ProfileInput } from '../../lib/crm-booking';

const empty: ProfileInput = {
  businessName: '',
  phone: '',
  email: '',
  location: '',
  brandPrimary: '',
  brandAccent: '',
  bookingIntro: '',
  policies: '',
  timezone: 'America/New_York',
};

const fieldClass = 'mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-[#0d1424] px-3 text-white';

export default function BusinessProfile() {
  const workspace = useOutletContext<CrmSelection>();
  const [input, setInput] = useState<ProfileInput>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let stopped = false;
    setLoading(true);
    setError('');
    getBookingSettings(workspace.organizationId)
      .then(settings => {
        if (stopped) return;
        if (!settings) {
          setError('Booking settings are not available for this workspace.');
          return;
        }
        setInput({
          businessName: settings.business_name,
          phone: settings.phone ?? '',
          email: settings.email ?? '',
          location: settings.location ?? '',
          brandPrimary: settings.brand_primary ?? '',
          brandAccent: settings.brand_accent ?? '',
          bookingIntro: settings.booking_intro ?? '',
          policies: settings.policies ?? '',
          timezone: settings.timezone,
        });
      })
      .catch(reason => { if (!stopped) setError(bookingError(reason, 'The business profile could not be loaded.')); })
      .finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; };
  }, [workspace.organizationId]);

  function setField<Key extends keyof ProfileInput>(key: Key, value: ProfileInput[Key]) {
    setInput(current => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await updateBookingSettings(workspace.organizationId, input);
      setNotice('Profile saved.');
    } catch (reason) {
      setError(bookingError(reason, 'The business profile could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  const zones = input.timezone && !bookingTimezones.includes(input.timezone as typeof bookingTimezones[number])
    ? [input.timezone, ...bookingTimezones]
    : [...bookingTimezones];

  return (
    <section className="max-w-2xl">
      <h1 className="text-3xl font-bold">Business profile</h1>
      <p className="mt-2 text-gray-300">This name, introduction, and contact information appear on the booking page.</p>
      {loading && <div className="mt-6 h-64 animate-pulse rounded-xl bg-[#0d1424]" />}
      {!loading && (
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          {error && <p role="alert" className="text-red-200">{error}</p>}
          {notice && <p role="status" className="text-[#7dd3f5]">{notice}</p>}
          <label className="block text-sm text-gray-300">Business name
            <input required maxLength={200} value={input.businessName} onChange={event => setField('businessName', event.target.value)} className={fieldClass} />
          </label>
          <label className="block text-sm text-gray-300">Phone
            <input maxLength={40} value={input.phone} onChange={event => setField('phone', event.target.value)} className={fieldClass} />
          </label>
          <label className="block text-sm text-gray-300">Email
            <input type="email" maxLength={320} value={input.email} onChange={event => setField('email', event.target.value)} className={fieldClass} />
          </label>
          <label className="block text-sm text-gray-300">Location
            <input maxLength={300} value={input.location} onChange={event => setField('location', event.target.value)} className={fieldClass} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-gray-300">Primary color
              <input maxLength={7} pattern="#[0-9A-Fa-f]{6}" placeholder="#2283B8" value={input.brandPrimary} onChange={event => setField('brandPrimary', event.target.value)} className={fieldClass} />
            </label>
            <label className="block text-sm text-gray-300">Accent color
              <input maxLength={7} pattern="#[0-9A-Fa-f]{6}" placeholder="#0A0F1E" value={input.brandAccent} onChange={event => setField('brandAccent', event.target.value)} className={fieldClass} />
            </label>
          </div>
          <label className="block text-sm text-gray-300">Timezone
            <select required value={input.timezone} onChange={event => setField('timezone', event.target.value)} className={fieldClass}>
              {zones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
            </select>
          </label>
          <label className="block text-sm text-gray-300">Booking introduction
            <textarea maxLength={2000} rows={4} value={input.bookingIntro} onChange={event => setField('bookingIntro', event.target.value)} className={fieldClass} />
          </label>
          <label className="block text-sm text-gray-300">Policies
            <textarea maxLength={4000} rows={5} value={input.policies} onChange={event => setField('policies', event.target.value)} className={fieldClass} />
          </label>
          <button type="submit" disabled={saving} className="min-h-11 rounded-lg bg-[#2283B8] px-4 font-semibold disabled:opacity-50">{saving ? 'Saving…' : 'Save profile'}</button>
        </form>
      )}
    </section>
  );
}
