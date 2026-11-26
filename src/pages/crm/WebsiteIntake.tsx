import { FormEvent, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import type { CrmSelection } from '../../lib/crm';
import {
  loadBusinessProfile,
  missingIntakeFields,
  saveBusinessProfile,
  websiteError,
  type WebsiteIntakeInput,
} from '../../lib/crm-website';
import { bookingTimezones } from '../../lib/crm-booking';

const empty: WebsiteIntakeInput = {
  publicName: '',
  industry: '',
  description: '',
  publicEmail: '',
  publicPhone: '',
  locationText: '',
  serviceArea: '',
  timezone: 'America/New_York',
  brandPrimary: '#2283B8',
  brandSecondary: '#0A0F1E',
  typographyPreference: '',
  styleDirection: '',
  primaryCtaLabel: 'Contact us',
  primaryCtaHref: '/contact',
  privateNotes: '',
};

const fieldClass = 'mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-[#0d1424] px-3 text-white';

export default function WebsiteIntake() {
  const workspace = useOutletContext<CrmSelection>();
  const [input, setInput] = useState<WebsiteIntakeInput>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!workspace.websiteEnabled) return;
    let stopped = false;
    setLoading(true);
    loadBusinessProfile(workspace.organizationId)
      .then(profile => {
        if (stopped || !profile) return;
        setComplete(profile.intake_complete === true);
        setInput({
          publicName: profile.public_name ?? workspace.name,
          industry: profile.industry ?? '',
          description: profile.description ?? '',
          publicEmail: profile.public_email ?? '',
          publicPhone: profile.public_phone ?? '',
          locationText: profile.location_text ?? '',
          serviceArea: profile.service_area ?? '',
          timezone: profile.timezone ?? 'America/New_York',
          brandPrimary: profile.brand_primary ?? '#2283B8',
          brandSecondary: profile.brand_secondary ?? '#0A0F1E',
          typographyPreference: profile.typography_preference ?? '',
          styleDirection: profile.style_direction ?? '',
          primaryCtaLabel: profile.primary_cta_label ?? 'Contact us',
          primaryCtaHref: profile.primary_cta_href ?? '/contact',
          privateNotes: profile.private_notes ?? '',
        });
      })
      .catch(reason => { if (!stopped) setError(websiteError(reason, 'Business intake could not be loaded.')); })
      .finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; };
  }, [workspace.organizationId, workspace.websiteEnabled, workspace.name]);

  function setField<Key extends keyof WebsiteIntakeInput>(key: Key, value: WebsiteIntakeInput[Key]) {
    setInput(current => ({ ...current, [key]: value }));
  }

  async function persist(markComplete: boolean) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      if (markComplete) {
        const missing = missingIntakeFields(input);
        if (missing.length) throw Error(`Missing required public information: ${missing.join(', ')}.`);
      }
      const saved = await saveBusinessProfile(workspace.organizationId, input, { complete: markComplete });
      setComplete(saved.intake_complete === true);
      setNotice(markComplete ? 'Intake marked complete. You can generate a draft website.' : 'Intake saved. You can return later.');
    } catch (reason) {
      setError(websiteError(reason, 'Business intake could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await persist(false);
  }

  if (!workspace.websiteEnabled) {
    return <p className="rounded-xl border border-gray-800 bg-[#0d1424] p-5 text-gray-200">This package does not include website generation.</p>;
  }

  const missing = missingIntakeFields(input);
  const zones = input.timezone && !bookingTimezones.includes(input.timezone as typeof bookingTimezones[number])
    ? [input.timezone, ...bookingTimezones]
    : [...bookingTimezones];

  return (
    <section className="max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Website intake</h1>
          <p className="mt-2 text-gray-300">Public fields are used for generation. Private notes stay in the workspace only.</p>
        </div>
        <Link to="/crm/website" className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-200">Back to website</Link>
      </div>
      {loading && <p className="mt-6 text-gray-400">Loading…</p>}
      {error && <p role="alert" className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
      {notice && <p role="status" className="mt-6 rounded-lg border border-[#2283B8]/30 bg-[#2283B8]/10 p-4 text-sm text-[#7dd3f5]">{notice}</p>}
      {!loading && (
        <form className="mt-8 space-y-6" onSubmit={event => { void onSave(event); }}>
          <div className="rounded-xl border border-gray-800 bg-[#0d1424] p-5">
            <h2 className="text-lg font-semibold">Public business information</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-gray-300">Business name<input className={fieldClass} required value={input.publicName} onChange={event => setField('publicName', event.target.value)} /></label>
              <label className="text-sm text-gray-300">Industry<input className={fieldClass} value={input.industry} onChange={event => setField('industry', event.target.value)} /></label>
              <label className="sm:col-span-2 text-sm text-gray-300">Public description<textarea className={`${fieldClass} min-h-28 py-3`} value={input.description} onChange={event => setField('description', event.target.value)} /></label>
              <label className="text-sm text-gray-300">Public email<input type="email" className={fieldClass} value={input.publicEmail} onChange={event => setField('publicEmail', event.target.value)} /></label>
              <label className="text-sm text-gray-300">Public phone<input className={fieldClass} value={input.publicPhone} onChange={event => setField('publicPhone', event.target.value)} /></label>
              <label className="text-sm text-gray-300">Location<input className={fieldClass} value={input.locationText} onChange={event => setField('locationText', event.target.value)} /></label>
              <label className="text-sm text-gray-300">Service area<input className={fieldClass} value={input.serviceArea} onChange={event => setField('serviceArea', event.target.value)} /></label>
              <label className="text-sm text-gray-300">Timezone
                <select className={fieldClass} value={input.timezone} onChange={event => setField('timezone', event.target.value)}>
                  {zones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
                </select>
              </label>
              <label className="text-sm text-gray-300">Primary CTA label<input className={fieldClass} value={input.primaryCtaLabel} onChange={event => setField('primaryCtaLabel', event.target.value)} /></label>
            </div>
          </div>
          <div className="rounded-xl border border-gray-800 bg-[#0d1424] p-5">
            <h2 className="text-lg font-semibold">Brand preferences</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-gray-300">Primary color<input className={fieldClass} value={input.brandPrimary} onChange={event => setField('brandPrimary', event.target.value)} /></label>
              <label className="text-sm text-gray-300">Secondary color<input className={fieldClass} value={input.brandSecondary} onChange={event => setField('brandSecondary', event.target.value)} /></label>
              <label className="text-sm text-gray-300">Typography preference<input className={fieldClass} value={input.typographyPreference} onChange={event => setField('typographyPreference', event.target.value)} /></label>
              <label className="text-sm text-gray-300">Style direction<input className={fieldClass} value={input.styleDirection} onChange={event => setField('styleDirection', event.target.value)} /></label>
            </div>
          </div>
          <div className="rounded-xl border border-gray-800 bg-[#0d1424] p-5">
            <h2 className="text-lg font-semibold">Private workspace notes</h2>
            <p className="mt-2 text-sm text-gray-400">Not published and not treated as public website facts.</p>
            <textarea className={`${fieldClass} mt-4 min-h-28 py-3`} value={input.privateNotes} onChange={event => setField('privateNotes', event.target.value)} />
          </div>
          {missing.length > 0 && (
            <p className="text-sm text-amber-200">Still needed for generation: {missing.join(', ')}.</p>
          )}
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={saving} className="min-h-11 rounded-lg border border-gray-700 px-4 font-semibold disabled:opacity-50">{saving ? 'Saving…' : 'Save and continue later'}</button>
            <button type="button" disabled={saving} className="min-h-11 rounded-lg bg-[#2283B8] px-4 font-semibold disabled:opacity-50" onClick={() => { void persist(true); }}>
              {saving ? 'Saving…' : complete ? 'Update and keep complete' : 'Mark intake complete'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
