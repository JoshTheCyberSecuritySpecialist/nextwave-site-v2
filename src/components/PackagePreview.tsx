import { useState, type KeyboardEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { bookingPackage, websiteCrmPackage } from '../data/offers';

type PackageTab = 'booking' | 'crm';
type DashboardMetric = 'inquiries' | 'upcoming' | 'unread' | 'overdue';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

const SAMPLE_SLOTS: Record<number, string[]> = {
  4: ['9:00 AM', '10:00 AM', '1:30 PM'],
  5: ['11:00 AM', '2:00 PM'],
  11: ['9:30 AM', '3:00 PM'],
};

const DASHBOARD_METRICS: { id: DashboardMetric; label: string; count: number; detail: string }[] = [
  {
    id: 'inquiries',
    label: 'New inquiries',
    count: 1,
    detail: 'Jordan Hale asked about a consultation. Sample inquiry only.',
  },
  {
    id: 'upcoming',
    label: 'Upcoming appointments',
    count: 1,
    detail: 'Consultation with Jordan Hale on Wednesday, November 4, 2026 at 10:00 AM.',
  },
  {
    id: 'unread',
    label: 'Unread messages',
    count: 1,
    detail: 'Sample email from Jordan Hale: “Can we keep the 10:00 AM time?”',
  },
  {
    id: 'overdue',
    label: 'Overdue tasks',
    count: 1,
    detail: 'Sample follow-up task due November 3, 2026: confirm the consultation details.',
  },
];

const firstWeekday = new Date(2026, 10, 1).getDay();
const novemberDays = Array.from({ length: 30 }, (_, index) => index + 1);

const dateLabel = (day: number) => {
  const weekday = WEEKDAY_NAMES[new Date(2026, 10, day).getDay()];
  return `${weekday}, November ${day}, 2026`;
};

const tabButtonClass = (selected: boolean) =>
  `inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-3 text-left text-base font-semibold transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none ${
    selected
      ? 'bg-[#2283B8] text-white'
      : 'border border-[#2BB0E8] text-white hover:bg-[#2283B8]/20'
  }`;

function SampleCalendar({
  label,
  selectedDay,
  selectedTime,
  onSelectDay,
  onSelectTime,
}: {
  label: string;
  selectedDay: number;
  selectedTime: string;
  onSelectDay: (day: number) => void;
  onSelectTime: (time: string) => void;
}) {
  const times = SAMPLE_SLOTS[selectedDay] ?? [];

  return (
    <div className="min-w-0 rounded-2xl border border-[#2283B8]/35 bg-[#003B5C]/80 p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-lg font-semibold text-white">Sample calendar</h4>
        <p className="text-sm text-slate-300">November 2026</p>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-300">{label}</p>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
        {WEEKDAY_LABELS.map((weekday) => (
          <div key={weekday} aria-hidden="true">
            {weekday}
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1" role="group" aria-label="Sample November 2026 dates">
        {Array.from({ length: firstWeekday }, (_, index) => (
          <div key={`blank-${index}`} aria-hidden="true" />
        ))}
        {novemberDays.map((day) => {
          const available = Boolean(SAMPLE_SLOTS[day]);
          const selected = day === selectedDay;

          if (!available) {
            return (
              <div
                key={day}
                aria-hidden="true"
                className="flex min-h-11 items-center justify-center rounded-lg text-sm text-slate-500"
              >
                {day}
              </div>
            );
          }

          return (
            <button
              key={day}
              type="button"
              aria-pressed={selected}
              aria-label={`${dateLabel(day)}, sample times available`}
              onClick={() => onSelectDay(day)}
              className={`flex min-h-11 items-center justify-center rounded-lg border text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                selected
                  ? 'border-[#7dd3f5] bg-[#2283B8] text-white'
                  : 'border-[#2283B8]/40 text-white hover:border-[#2BB0E8]'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
      <div className="mt-4">
        <h5 className="text-sm font-semibold uppercase tracking-wide text-[#7dd3f5]">
          Sample times for {dateLabel(selectedDay)}
        </h5>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`Sample times on ${dateLabel(selectedDay)}`}>
          {times.map((time) => {
            const selected = time === selectedTime;
            return (
              <button
                key={time}
                type="button"
                aria-pressed={selected}
                onClick={() => onSelectTime(time)}
                className={`inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  selected
                    ? 'border-[#7dd3f5] bg-[#2283B8] text-white'
                    : 'border-[#2283B8]/40 text-white hover:border-[#2BB0E8]'
                }`}
              >
                {time}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StarterPreview() {
  const [selectedDay, setSelectedDay] = useState(4);
  const [selectedTime, setSelectedTime] = useState('10:00 AM');

  const chooseDay = (day: number) => {
    const times = SAMPLE_SLOTS[day];
    setSelectedDay(day);
    if (times && !times.includes(selectedTime)) {
      setSelectedTime(times[0]);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <SampleCalendar
        label="One sample calendar. Highlighted dates have example times."
        selectedDay={selectedDay}
        selectedTime={selectedTime}
        onSelectDay={chooseDay}
        onSelectTime={setSelectedTime}
      />
      <div className="min-w-0 rounded-2xl border border-[#2283B8]/35 bg-[#003B5C]/80 p-4 sm:p-5" aria-live="polite">
        <h4 className="text-lg font-semibold text-white">Details collected for this sample appointment</h4>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {bookingPackage.scopeNote} Selecting a time only changes this example.
        </p>
        <dl className="mt-5 space-y-3 text-base leading-7">
          {[
            ['Name', 'Jordan Hale'],
            ['Phone', '(555) 010-0142'],
            ['Email', 'jordan.hale@example.com'],
            ['Service', 'Consultation'],
            ['Requested time', `${dateLabel(selectedDay)} at ${selectedTime}`],
          ].map(([term, value]) => (
            <div key={term} className="grid grid-cols-1 gap-1 border-b border-[#2283B8]/20 pb-3 sm:grid-cols-[9rem_1fr]">
              <dt className="font-semibold text-[#7dd3f5]">{term}</dt>
              <dd className="min-w-0 break-words text-white">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function CrmPreview() {
  const [metric, setMetric] = useState<DashboardMetric>('inquiries');
  const [selectedDay, setSelectedDay] = useState(4);
  const [selectedTime, setSelectedTime] = useState('10:00 AM');
  const activeMetric = DASHBOARD_METRICS.find((item) => item.id === metric) ?? DASHBOARD_METRICS[0];

  const chooseDay = (day: number) => {
    const times = SAMPLE_SLOTS[day];
    setSelectedDay(day);
    if (times && !times.includes(selectedTime)) {
      setSelectedTime(times[0]);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-lg font-semibold text-white">Sample dashboard</h4>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          These four counts match the dashboard described for this package. They are sample numbers.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {DASHBOARD_METRICS.map((item) => {
            const selected = item.id === metric;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setMetric(item.id)}
                className={`min-h-11 rounded-2xl border p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  selected
                    ? 'border-[#7dd3f5] bg-[#2283B8]/30'
                    : 'border-[#2283B8]/35 bg-[#003B5C]/80 hover:border-[#2BB0E8]'
                }`}
              >
                <span className="block text-3xl font-bold text-white">{item.count}</span>
                <span className="mt-1 block text-sm font-semibold leading-6 text-slate-100">{item.label}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-base leading-7 text-slate-200" aria-live="polite">
          {activeMetric.detail}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SampleCalendar
          label="One staff calendar in this sample. Choosing a time does not book anything."
          selectedDay={selectedDay}
          selectedTime={selectedTime}
          onSelectDay={chooseDay}
          onSelectTime={setSelectedTime}
        />
        <article className="min-w-0 rounded-2xl border border-[#2283B8]/35 bg-[#003B5C]/80 p-4 sm:p-5" aria-live="polite">
          <h4 className="text-lg font-semibold text-white">Sample customer record</h4>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Selected sample time: {dateLabel(selectedDay)} at {selectedTime}. The record below stays the same fictional example.
          </p>
          <dl className="mt-5 space-y-3 text-base leading-7">
            {[
              ['Name', 'Jordan Hale'],
              ['Phone', '(555) 010-0142'],
              ['Email', 'jordan.hale@example.com'],
              ['Lead stage', 'Inquiry'],
              ['Tags', 'Consultation'],
              ['Notes', 'Asked for a morning consultation. Sample note only.'],
              ['Booking history', 'Wednesday, November 4, 2026 at 10:00 AM — Consultation'],
              ['Email on record', 'From Jordan Hale: “Can we keep the 10:00 AM time?”'],
            ].map(([term, value]) => (
              <div key={term} className="grid grid-cols-1 gap-1 border-b border-[#2283B8]/20 pb-3 sm:grid-cols-[9rem_1fr]">
                <dt className="font-semibold text-[#7dd3f5]">{term}</dt>
                <dd className="min-w-0 break-words text-white">{value}</dd>
              </div>
            ))}
          </dl>
        </article>
      </div>
    </div>
  );
}

export function PackagePreview() {
  const reduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<PackageTab>('booking');
  const tabs: { id: PackageTab; label: string }[] = [
    { id: 'booking', label: `${bookingPackage.name} — ${bookingPackage.priceDisplay}` },
    { id: 'crm', label: `${websiteCrmPackage.name} — ${websiteCrmPackage.priceDisplay}` },
  ];

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % tabs.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    setActiveTab(nextTab.id);
    document.getElementById(`preview-tab-${nextTab.id}`)?.focus();
  };

  return (
    <motion.section
      id="package-preview"
      aria-labelledby="package-preview-heading"
      className="scroll-mt-24 py-16 sm:py-24"
      initial={reduceMotion === false ? { opacity: 0, y: 12 } : false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      transition={{ duration: 0.35 }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#7dd3f5]">Demonstration</p>
          <h2 id="package-preview-heading" className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            See what each package includes
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-200">
            Fictional sample data for Jordan Hale. These previews are not connected to a live system. Nothing you select is saved, booked, or sent.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Package demonstrations"
          aria-orientation="horizontal"
          className="mt-8 flex flex-col gap-3 sm:flex-row"
        >
          {tabs.map((tab, index) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`preview-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`preview-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                className={`${tabButtonClass(selected)} w-full sm:w-auto`}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(event) => onTabKeyDown(event, index)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id="preview-panel-booking"
          aria-labelledby="preview-tab-booking"
          hidden={activeTab !== 'booking'}
          className="mt-6"
        >
          {activeTab === 'booking' ? <StarterPreview /> : null}
        </div>
        <div
          role="tabpanel"
          id="preview-panel-crm"
          aria-labelledby="preview-tab-crm"
          hidden={activeTab !== 'crm'}
          className="mt-6"
        >
          {activeTab === 'crm' ? <CrmPreview /> : null}
        </div>
      </div>
    </motion.section>
  );
}
