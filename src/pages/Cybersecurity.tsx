import { contactPath } from '../data/offers';

interface CybersecurityProps {
  onNavigate: (page: string) => void;
}

const topics = [
  'Vulnerability scanning',
  'Linux and Windows hardening',
  'Account and access review',
  'Firewall and network setup',
  'Device management for business computers',
  'Microsoft 365 security configuration',
];

export const Cybersecurity = ({ onNavigate }: CybersecurityProps) => {
  return (
    <div className="overflow-x-clip px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Cybersecurity</h1>
          <p className="mt-4 text-lg leading-8 text-slate-200">
            Practical security work for business systems. This is scoped separately from booking systems and the website + CRM package.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="min-w-0 rounded-2xl border border-[#2283B8]/35 bg-[#001F33]/75 p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-white">What we can review</h2>
            <ul className="mt-6 space-y-3 text-base leading-7 text-slate-100">
              {topics.map((topic) => (
                <li key={topic}>{topic}</li>
              ))}
            </ul>
          </section>
          <section className="min-w-0 rounded-2xl border border-[#2283B8]/35 bg-[#001F33]/75 p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-white">How a project starts</h2>
            <p className="mt-4 text-base leading-7 text-slate-200">
              We confirm the systems, access, and outcome before work begins. A review can cover one network, a set of accounts, or a Microsoft 365 tenant. The written scope sets what is included.
            </p>
            <p className="mt-4 text-base leading-7 text-slate-200">
              Compliance programs, incident response retainers, and product-specific deployments are quoted on their own. They are not part of the booking or website packages.
            </p>
            <button
              type="button"
              onClick={() => onNavigate(contactPath('cybersecurity'))}
              className="mt-8 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#2283B8] px-5 py-3 text-base font-semibold text-white hover:bg-[#1b6d99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Discuss Cybersecurity
            </button>
          </section>
        </div>
      </div>
    </div>
  );
};
