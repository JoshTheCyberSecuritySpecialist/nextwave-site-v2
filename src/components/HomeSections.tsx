import { additionalServices, gettingStartedSteps, scopeFaqs } from '../data/offers';

const relationshipExamples = [
  {
    title: 'Review the history first',
    text: 'Review customer notes and past appointments before replying.',
  },
  {
    title: 'Keep the email with the customer',
    text: 'Keep individual email conversations connected to the customer record.',
  },
  {
    title: 'Set the next step',
    text: 'Create a dated follow-up task after an inquiry or appointment.',
  },
  {
    title: 'See what needs attention',
    text: 'Check unread messages and overdue tasks from the dashboard.',
  },
];

const configurationExamples = [
  {
    title: 'A salon appointment',
    text: 'Service names, appointment length, and available hours can be set for a salon-style visit.',
  },
  {
    title: 'A consultation',
    text: 'A consultation can collect contact details and a short note about what the customer wants to discuss.',
  },
  {
    title: 'A local service appointment',
    text: 'A local service visit can use your service list, your wording, and the hours you choose.',
  },
];

interface HomeSectionsProps {
  onNavigate: (page: string) => void;
}

export const HomeSections = ({ onNavigate }: HomeSectionsProps) => {
  return (
    <>
      <section aria-labelledby="relationships-heading" className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h2 id="relationships-heading" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Keep the details. Continue the conversation.
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-200">
              The website + CRM package gives you a place to keep customer details and handle the next conversation yourself.
              Follow-up tasks and individual email conversations are included. This is not automated marketing, bulk messaging, or automatic replies.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
            {relationshipExamples.map((item) => (
              <article key={item.title} className="min-w-0 rounded-2xl border border-[#2283B8]/30 bg-[#001F33]/70 p-6">
                <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-base leading-7 text-slate-200">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="customization-heading" className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h2 id="customization-heading" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Built around the way your business books.
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-200">
              Service names, branding, availability, page content, forms, and messages can be adapted within the agreed scope.
              The examples below are possible configurations, not existing clients or a promise that every scheduling style will fit.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {configurationExamples.map((item) => (
              <article key={item.title} className="min-w-0 rounded-2xl border border-[#2283B8]/30 bg-[#001F33]/70 p-6">
                <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-base leading-7 text-slate-200">{item.text}</p>
              </article>
            ))}
          </div>
          <p className="mt-8 max-w-3xl text-base leading-7 text-slate-200">
            Specialized scheduling, multiple staff calendars, shared-capacity tours, overnight rentals, and complex workflows require a scope review.
          </p>
        </div>
      </section>

      <section aria-labelledby="getting-started-heading" className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 id="getting-started-heading" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Getting started
          </h2>
          <ol className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
            {gettingStartedSteps.map((step, index) => (
              <li key={step.title} className="min-w-0 rounded-2xl border border-[#2283B8]/30 bg-[#001F33]/70 p-6">
                <h3 className="text-xl font-semibold text-white">
                  <span className="mr-2 text-[#7dd3f5]">{index + 1}.</span>
                  {step.title}
                </h3>
                <p className="mt-3 text-base leading-7 text-slate-200">{step.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="faq-heading" className="py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 id="faq-heading" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Scope and common questions
          </h2>
          <div className="mt-8 space-y-3">
            {scopeFaqs.map((item) => (
              <details key={item.question} className="rounded-xl border border-[#2283B8]/30 bg-[#001F33]/70 p-4 sm:p-5">
                <summary className="cursor-pointer text-lg font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3f5]">
                  <h3 className="text-lg font-semibold text-white">{item.question}</h3>
                </summary>
                <p className="mt-3 text-base leading-7 text-slate-200">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="other-services-heading" className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h2 id="other-services-heading" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Other services
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-200">
              Cybersecurity, IT support, and automation remain available. They are scoped separately from the booking and website packages.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {additionalServices.map((service) => (
              <article key={service.path} className="min-w-0 rounded-2xl border border-[#2283B8]/30 bg-[#001F33]/70 p-6">
                <h3 className="text-xl font-semibold text-white">{service.title}</h3>
                <p className="mt-3 text-base leading-7 text-slate-200">{service.summary}</p>
                <button
                  type="button"
                  onClick={() => onNavigate(service.path)}
                  className="mt-5 inline-flex min-h-11 items-center text-base font-semibold text-[#7dd3f5] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7dd3f5]"
                >
                  View {service.title}
                </button>
              </article>
            ))}
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => onNavigate('portfolio')}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#2BB0E8] px-5 py-3 text-base font-semibold text-white hover:bg-[#2283B8]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              View project work
            </button>
            <button
              type="button"
              onClick={() => onNavigate('contact')}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#2283B8] px-5 py-3 text-base font-semibold text-white hover:bg-[#1b6d99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Discuss Your Business
            </button>
          </div>
        </div>
      </section>
    </>
  );
};
