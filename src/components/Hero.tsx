interface HeroProps {
  onNavigate: (page: string) => void;
}

export const Hero = ({ onNavigate }: HeroProps) => {
  return (
    <div className="w-full max-w-xl shrink-0">
      <p className="text-sm font-semibold uppercase tracking-wide text-[#7dd3f5]">
        NextWave Digital Solutions
      </p>
      <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
        Make booking easier. Keep customers connected.
      </h1>
      <p className="mt-6 text-lg leading-8 text-slate-200 sm:text-xl">
        Booking systems and websites that help your business organize appointments, manage customer details and follow up with confidence.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <a
          href="#packages"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#2283B8] px-6 py-3 text-center text-base font-semibold text-white hover:bg-[#1b6d99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Compare Packages
        </a>
        <button
          type="button"
          onClick={() => onNavigate('contact')}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#2BB0E8] px-6 py-3 text-base font-semibold text-white hover:bg-[#2283B8]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Discuss Your Business
        </button>
      </div>
    </div>
  );
};
