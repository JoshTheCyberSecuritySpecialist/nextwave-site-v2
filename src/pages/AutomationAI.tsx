import { bookingPackage, contactPath, websiteCrmPackage } from '../data/offers';

interface AutomationAIProps {
  onNavigate: (page: string) => void;
}

export const AutomationAI = ({ onNavigate }: AutomationAIProps) => {
  return (
    <div className="overflow-x-clip px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Automation</h1>
          <p className="mt-4 text-lg leading-8 text-slate-200">
            Automation connects tools you already use. It is quoted separately and is not included in the {bookingPackage.priceDisplay} booking package or the {websiteCrmPackage.priceDisplay} website + CRM package.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="min-w-0 rounded-2xl border border-[#2283B8]/35 bg-[#001F33]/75 p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-white">Included with website + CRM</h2>
            <ul className="mt-6 space-y-3 text-base leading-7 text-slate-100">
              <li>Follow-up tasks with due dates</li>
              <li>Individual email conversations tied to a customer record</li>
              <li>Appointment confirmations and one configurable reminder template</li>
            </ul>
            <p className="mt-6 text-base leading-7 text-slate-200">
              Those are manual tools for your team. They are not automated marketing campaigns, bulk email, or automatic replies.
            </p>
          </section>
          <section className="min-w-0 rounded-2xl border border-[#2283B8]/35 bg-[#001F33]/75 p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-white">Quoted separately</h2>
            <ul className="mt-6 space-y-3 text-base leading-7 text-slate-100">
              <li>Connections between existing business tools</li>
              <li>Moving data from an old system</li>
              <li>Gmail or Outlook synchronization</li>
              <li>Bulk email and SMS</li>
              <li>Custom workflows that do not fit the package limits</li>
            </ul>
            <p className="mt-6 text-base leading-7 text-slate-200">
              Tell us which tools you use and which step you want to remove. We confirm the scope in writing before work begins.
            </p>
            <button
              type="button"
              onClick={() => onNavigate(contactPath('automation'))}
              className="mt-8 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#2283B8] px-5 py-3 text-base font-semibold text-white hover:bg-[#1b6d99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Discuss Automation
            </button>
          </section>
        </div>
      </div>
    </div>
  );
};
