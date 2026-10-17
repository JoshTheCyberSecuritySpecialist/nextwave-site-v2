import { contactPath } from '../data/offers';

interface LocalITSupportProps {
  onNavigate: (page: string) => void;
}

const topics = [
  'Servers',
  'Networks',
  'Backup and recovery planning',
  'Remote support',
  'Email and Microsoft 365 configuration',
];

export const LocalITSupport = ({ onNavigate }: LocalITSupportProps) => {
  return (
    <div className="overflow-x-clip px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">IT Support</h1>
          <p className="mt-4 text-lg leading-8 text-slate-200">
            Day-to-day help for business computers, networks, and email. IT support is scoped separately from booking systems and the website + CRM package.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="min-w-0 rounded-2xl border border-[#2283B8]/35 bg-[#001F33]/75 p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-white">What we can support</h2>
            <ul className="mt-6 space-y-3 text-base leading-7 text-slate-100">
              {topics.map((topic) => (
                <li key={topic}>{topic}</li>
              ))}
            </ul>
            <p className="mt-6 text-base leading-7 text-slate-200">
              NextWave Digital Solutions is based in Florida and can work remotely or arrange on-site support when the scope calls for it.
            </p>
          </section>
          <section className="min-w-0 rounded-2xl border border-[#2283B8]/35 bg-[#001F33]/75 p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-white">Before work begins</h2>
            <p className="mt-4 text-base leading-7 text-slate-200">
              We confirm the systems, the hours of help, and whether the work is a one-time setup or ongoing support. Website and CRM hosting is a different service and is not included here.
            </p>
            <button
              type="button"
              onClick={() => onNavigate(contactPath('it-support'))}
              className="mt-8 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#2283B8] px-5 py-3 text-base font-semibold text-white hover:bg-[#1b6d99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Discuss IT Support
            </button>
          </section>
        </div>
      </div>
    </div>
  );
};
