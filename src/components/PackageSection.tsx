import { TestCheckoutLink } from './TestCheckoutLink';
import { bookingPackage, comparisonRows, contactPath, websiteCrmPackage } from '../data/offers';

interface PackageSectionProps {
  onNavigate: (page: string) => void;
}

const cardClass =
  'flex h-full min-w-0 flex-col rounded-2xl border border-[#2283B8]/35 bg-[#001F33]/75 p-6 sm:p-8';

const listClass = 'mt-6 space-y-3 text-base leading-6 text-slate-100';

const buttonClass =
  'inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#2283B8] px-5 py-3 text-center text-base font-semibold text-white transition-colors hover:bg-[#1b6d99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

const testCheckoutClass =
  'inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[#2BB0E8] px-5 py-3 text-center text-base font-semibold text-white hover:bg-[#2283B8]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

export const PackageSection = ({ onNavigate }: PackageSectionProps) => {
  return (
    <section id="packages" aria-labelledby="packages-heading" className="scroll-mt-24 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <h2 id="packages-heading" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Compare packages
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-200">
            CRM means customer relationship management: a record of each customer’s details, notes, and conversations.
            Choose booking on its own, or a website with booking and CRM.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
          <article className={cardClass}>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7dd3f5]">Package 1</p>
            <h3 className="mt-3 text-2xl font-bold text-white">{bookingPackage.name}</h3>
            <p className="mt-4 text-4xl font-bold text-white">{bookingPackage.priceDisplay}</p>
            <p className="mt-4 rounded-lg border border-[#2283B8]/40 bg-[#003B5C] p-4 text-base leading-7 text-slate-100">
              {bookingPackage.scopeNote}
            </p>
            <ul className={listClass}>
              {bookingPackage.includes.map((item) => (
                <li key={item} className="flex gap-3">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2BB0E8]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-base leading-7 text-slate-200">{bookingPackage.kickoffNote}</p>
            <div className="mt-8 flex flex-col gap-3">
              <TestCheckoutLink packageId={bookingPackage.id} className={buttonClass} />
              <button
                type="button"
                className={testCheckoutClass}
                onClick={() => onNavigate(contactPath(bookingPackage.id))}
              >
                {bookingPackage.cta}
              </button>
            </div>
          </article>

          <article className={cardClass}>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7dd3f5]">Package 2</p>
            <h3 className="mt-3 text-2xl font-bold text-white">{websiteCrmPackage.name}</h3>
            <p className="mt-4 text-4xl font-bold text-white">{websiteCrmPackage.priceDisplay}</p>
            <div className="mt-4 space-y-3 rounded-lg border border-[#2BB0E8]/50 bg-[#003B5C] p-4 text-base leading-7 text-slate-100">
              <p>{websiteCrmPackage.hostingIntro}</p>
              <p className="font-semibold text-white">{websiteCrmPackage.hostingThen}</p>
              <p>{websiteCrmPackage.monthlyIncludes}</p>
              <p>{websiteCrmPackage.billingNote}</p>
            </div>
            <ul className={listClass}>
              {websiteCrmPackage.includes.map((item) => (
                <li key={item} className="flex gap-3">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2BB0E8]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-base leading-7 text-slate-200">
              <span className="font-semibold text-white">Package limits. </span>
              {websiteCrmPackage.limits}
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <TestCheckoutLink packageId={websiteCrmPackage.id} className={buttonClass} />
              <button
                type="button"
                className={testCheckoutClass}
                onClick={() => onNavigate(contactPath(websiteCrmPackage.id))}
              >
                {websiteCrmPackage.cta}
              </button>
            </div>
          </article>
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-[#2283B8]/35">
          <h3 className="border-b border-[#2283B8]/35 bg-[#001F33]/80 px-4 py-4 text-xl font-bold text-white sm:px-6">
            Side-by-side
          </h3>
          <div className="hidden grid-cols-3 gap-4 border-b border-[#2283B8]/25 bg-[#003B5C]/80 px-6 py-3 text-sm font-semibold text-slate-200 md:grid">
            <span>Item</span>
            <span>{bookingPackage.priceDisplay} booking only</span>
            <span>{websiteCrmPackage.priceDisplay} website + CRM</span>
          </div>
          <div>
            {comparisonRows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-1 gap-2 border-b border-[#2283B8]/20 px-4 py-4 last:border-b-0 sm:px-6 md:grid-cols-3 md:gap-4"
              >
                <p className="font-semibold text-white">{row.label}</p>
                <p className="min-w-0 break-words text-base leading-7 text-slate-100">
                  <span className="font-medium text-[#7dd3f5] md:hidden">Booking only: </span>
                  {row.booking}
                </p>
                <p className="min-w-0 break-words text-base leading-7 text-slate-100">
                  <span className="font-medium text-[#7dd3f5] md:hidden">Website + CRM: </span>
                  {row.website}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
