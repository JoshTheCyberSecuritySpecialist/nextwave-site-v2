import { FormEvent, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { CrmSelection } from '../../lib/crm';
import { bookingError, emptyWeek, listWeeklyHours, minutesToTime, saveWeeklyHours, weekdays, type DayInput } from '../../lib/crm-booking';

const fieldClass = 'min-h-11 rounded-lg border border-gray-700 bg-[#0A0F1E] px-3 text-white disabled:opacity-40';

export default function WeeklyHours() {
  const workspace = useOutletContext<CrmSelection>();
  const [days, setDays] = useState<DayInput[]>(emptyWeek);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let stopped = false;
    setLoading(true);
    setError('');
    listWeeklyHours(workspace.organizationId)
      .then(schedule => {
        if (stopped) return;
        const byDay = new Map(schedule.windows.map(window => [window.weekday, window]));
        setDays(emptyWeek().map(day => {
          const window = byDay.get(day.weekday);
          if (!window) return day;
          return { weekday: day.weekday, closed: false, start: minutesToTime(window.start_minute), end: minutesToTime(window.end_minute) };
        }));
      })
      .catch(reason => { if (!stopped) setError(bookingError(reason, 'Weekly hours could not be loaded.')); })
      .finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; };
  }, [workspace.organizationId]);

  function updateDay(weekday: number, patch: Partial<DayInput>) {
    setDays(current => current.map(day => day.weekday === weekday ? { ...day, ...patch } : day));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await saveWeeklyHours(workspace.organizationId, days);
      setNotice('Weekly hours saved.');
    } catch (reason) {
      setError(bookingError(reason, 'Weekly hours could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="max-w-3xl">
      <h1 className="text-3xl font-bold">Weekly hours</h1>
      <p className="mt-2 text-gray-300">One staff calendar. Leave a day closed when it should not appear on the booking page.</p>
      {loading && <div className="mt-6 h-64 animate-pulse rounded-xl bg-[#0d1424]" />}
      {!loading && (
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          {error && <p role="alert" className="text-red-200">{error}</p>}
          {notice && <p role="status" className="text-[#7dd3f5]">{notice}</p>}
          <ul className="space-y-3">
            {days.map(day => {
              const label = weekdays.find(item => item.value === day.weekday)?.label ?? 'Day';
              return (
                <li key={day.weekday} className="rounded-xl border border-gray-800 bg-[#0d1424] p-4">
                  <div className="grid gap-3 sm:grid-cols-[9rem_1fr_1fr] sm:items-center">
                    <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={!day.closed}
                        onChange={event => updateDay(day.weekday, { closed: !event.target.checked })}
                        className="h-4 w-4"
                      />
                      <span>{label}</span>
                      <span className="font-normal text-gray-400">{day.closed ? 'Closed' : 'Open'}</span>
                    </label>
                    <label className="text-sm text-gray-300">Opens
                      <input
                        type="time"
                        required={!day.closed}
                        disabled={day.closed}
                        value={day.start}
                        aria-label={`${label} opens`}
                        onChange={event => updateDay(day.weekday, { start: event.target.value })}
                        className={`${fieldClass} mt-1 w-full`}
                      />
                    </label>
                    <label className="text-sm text-gray-300">Closes
                      <input
                        type="time"
                        required={!day.closed}
                        disabled={day.closed}
                        value={day.end}
                        aria-label={`${label} closes`}
                        onChange={event => updateDay(day.weekday, { end: event.target.value })}
                        className={`${fieldClass} mt-1 w-full`}
                      />
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
          <button type="submit" disabled={saving} className="min-h-11 rounded-lg bg-[#2283B8] px-4 font-semibold disabled:opacity-50">{saving ? 'Saving…' : 'Save weekly hours'}</button>
        </form>
      )}
    </section>
  );
}
