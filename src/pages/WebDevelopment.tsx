import { TestCheckoutLink } from '../components/TestCheckoutLink';
import { bookingPackage, contactPath, websiteCrmPackage, websiteSetupItems } from '../data/offers';

interface WebDevelopmentProps {
  onNavigate: (page: string) => void;
}

export const WebDevelopment = ({ onNavigate }: WebDevelopmentProps) => {
  return (
    <div className="overflow-x-clip px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#7dd3f5]">Website package</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {websiteCrmPackage.name}
          </h1>
          <p className="mt-4 text-lg leading-8 text-slate-200">
            The {websiteCrmPackage.priceDisplay} package includes a business website, booking, and customer relationship management (CRM).
            The {bookingPackage.priceDisplay} booking package does not include a website.
          </p>
          <p className="mt-4 text-base leading-7">
            <a href="/#demo" className="font-semibold text-[#7dd3f5] underline-offset-4 hover:underline">
              Watch the website and CRM demonstration
            </a>
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="min-w-0 rounded-2xl border border-[#2283B8]/35 bg-[#001F33]/75 p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-white">Website setup</h2>
            <ul className="mt-6 space-y-3 text-base leading-7 text-slate-100">
              {websiteSetupItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="mt-6 text-base leading-7 text-slate-200">
              You provide the logo, photos, and wording. Domain registration is separate. The package includes connecting a domain you already have.
              It also includes {websiteCrmPackage.revision.toLowerCase()} and {websiteCrmPackage.training.toLowerCase()}.
            </p>
          </section>

          <section className="min-w-0 rounded-2xl border border-[#2283B8]/35 bg-[#001F33]/75 p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-white">Price and hosting</h2>
            <p className="mt-4 text-4xl font-bold text-white">{websiteCrmPackage.priceDisplay}</p>
            <div className="mt-4 space-y-3 text-base leading-7 text-slate-100">
              <p>{websiteCrmPackage.hostingIntro}</p>
              <p className="font-semibold text-white">{websiteCrmPackage.hostingThen}</p>
              <p>{websiteCrmPackage.monthlyIncludes}</p>
              <p>{websiteCrmPackage.billingNote}</p>
            </div>
            <p className="mt-6 text-base leading-7 text-slate-200">
              <span className="font-semibold text-white">Package limits. </span>
              {websiteCrmPackage.limits}
            </p>
          </section>
        </div>

        <section className="mt-8 max-w-3xl rounded-2xl border border-[#2283B8]/30 bg-[#001F33]/70 p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-white">Beyond this package</h2>
          <p className="mt-4 text-base leading-7 text-slate-200">
            Packages customize an existing design and supported system configuration. More than five pages, a custom web application, SMS, payment collection, and other bespoke development need a separate quote.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <TestCheckoutLink
              packageId={websiteCrmPackage.id}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#2283B8] px-5 py-3 text-base font-semibold text-white hover:bg-[#1b6d99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            />
            <button
              type="button"
              onClick={() => onNavigate(contactPath(websiteCrmPackage.id))}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#2BB0E8] px-5 py-3 text-base font-semibold text-white hover:bg-[#2283B8]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {websiteCrmPackage.cta}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/#packages')}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#2BB0E8] px-5 py-3 text-base font-semibold text-white hover:bg-[#2283B8]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Compare packages
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
