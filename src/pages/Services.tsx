import { additionalServices, bookingPackage, contactPath, websiteCrmPackage } from '../data/offers';

interface ServicesProps {
  onNavigate: (page: string) => void;
}

const primaryButton =
  'inline-flex min-h-11 items-center justify-center rounded-lg bg-[#2283B8] px-5 py-3 text-center text-base font-semibold text-white hover:bg-[#1b6d99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

const secondaryButton =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-[#2BB0E8] px-5 py-3 text-center text-base font-semibold text-white hover:bg-[#2283B8]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

export const Services = ({ onNavigate }: ServicesProps) => {
  return (
    <div className="overflow-x-clip px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Services</h1>
          <p className="mt-4 text-lg leading-8 text-slate-200">
            Booking systems and websites with customer relationship management (CRM) are the main offer.
            Cybersecurity, IT support, and automation are available as separate work.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <article className="flex min-w-0 flex-col rounded-2xl border border-[#2283B8]/35 bg-[#001F33]/75 p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-white">{bookingPackage.name}</h2>
            <p className="mt-4 text-4xl font-bold text-white">{bookingPackage.priceDisplay}</p>
            <p className="mt-4 text-base leading-7 text-slate-100">{bookingPackage.scopeNote}</p>
            <ul className="mt-6 space-y-3 text-base leading-7 text-slate-100">
              {bookingPackage.includes.map((item) => (
                <li key={item} className="flex gap-3">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2BB0E8]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-base leading-7 text-slate-200">{bookingPackage.kickoffNote}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button type="button" className={primaryButton} onClick={() => onNavigate(contactPath(bookingPackage.id))}>
                {bookingPackage.cta}
              </button>
              <button type="button" className={secondaryButton} onClick={() => onNavigate('/#packages')}>
                Compare packages
              </button>
            </div>
          </article>

          <article className="flex min-w-0 flex-col rounded-2xl border border-[#2283B8]/35 bg-[#001F33]/75 p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-white">{websiteCrmPackage.name}</h2>
            <p className="mt-4 text-4xl font-bold text-white">{websiteCrmPackage.priceDisplay}</p>
            <div className="mt-4 space-y-3 rounded-lg border border-[#2BB0E8]/50 bg-[#003B5C] p-4 text-base leading-7 text-slate-100">
              <p>{websiteCrmPackage.hostingIntro}</p>
              <p className="font-semibold text-white">{websiteCrmPackage.hostingThen}</p>
              <p>{websiteCrmPackage.monthlyIncludes}</p>
              <p>{websiteCrmPackage.billingNote}</p>
            </div>
            <p className="mt-6 text-base leading-7 text-slate-200">
              <span className="font-semibold text-white">Package limits. </span>
              {websiteCrmPackage.limits}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button type="button" className={primaryButton} onClick={() => onNavigate(contactPath(websiteCrmPackage.id))}>
                {websiteCrmPackage.cta}
              </button>
              <button type="button" className={secondaryButton} onClick={() => onNavigate('web-development')}>
                Website details
              </button>
            </div>
          </article>
        </div>

        <section aria-labelledby="other-services-heading" className="mt-20">
          <h2 id="other-services-heading" className="text-3xl font-bold text-white">
            Separate services
          </h2>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-200">
            These are not included in the {bookingPackage.priceDisplay} or {websiteCrmPackage.priceDisplay} packages.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {additionalServices.map((service) => (
              <article key={service.id} className="flex min-w-0 flex-col rounded-2xl border border-[#2283B8]/30 bg-[#001F33]/70 p-6">
                <h3 className="text-xl font-semibold text-white">{service.title}</h3>
                <p className="mt-3 flex-1 text-base leading-7 text-slate-200">{service.summary}</p>
                <div className="mt-6 flex flex-col gap-3">
                  <button type="button" className={secondaryButton} onClick={() => onNavigate(service.path)}>
                    View {service.title}
                  </button>
                  <button type="button" className={primaryButton} onClick={() => onNavigate(contactPath(service.id))}>
                    Discuss {service.title}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
