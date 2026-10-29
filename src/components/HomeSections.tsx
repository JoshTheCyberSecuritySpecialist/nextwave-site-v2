import { type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  Mail,
  MapPin,
  MessageSquare,
  Monitor,
  Scissors,
  Shield,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { additionalServices, gettingStartedSteps, scopeFaqs } from '../data/offers';

const relationshipExamples: { title: string; text: string; icon: LucideIcon }[] = [
  {
    title: 'Review the history first',
    text: 'Review customer notes and past appointments before replying.',
    icon: ClipboardList,
  },
  {
    title: 'Keep the email with the customer',
    text: 'Keep individual email conversations connected to the customer record.',
    icon: Mail,
  },
  {
    title: 'Set the next step',
    text: 'Create a dated follow-up task after an inquiry or appointment.',
    icon: ListChecks,
  },
  {
    title: 'See what needs attention',
    text: 'Check unread messages and overdue tasks from the dashboard.',
    icon: LayoutDashboard,
  },
];

const configurationExamples: { title: string; text: string; icon: LucideIcon }[] = [
  {
    title: 'A salon appointment',
    text: 'Service names, appointment length, and available hours can be set for a salon-style visit.',
    icon: Scissors,
  },
  {
    title: 'A consultation',
    text: 'A consultation can collect contact details and a short note about what the customer wants to discuss.',
    icon: MessageSquare,
  },
  {
    title: 'A local service appointment',
    text: 'A local service visit can use your service list, your wording, and the hours you choose.',
    icon: MapPin,
  },
];

const serviceIcons: Record<(typeof additionalServices)[number]['id'], LucideIcon> = {
  cybersecurity: Shield,
  'it-support': Monitor,
  automation: Workflow,
};

const cardClass =
  'group min-w-0 rounded-2xl border border-[#2283B8]/30 bg-[#001F33]/70 p-6 shadow-lg shadow-black/15 transition-[border-color,box-shadow] duration-200 hover:border-[#2BB0E8]/65 hover:shadow-xl hover:shadow-[#2283B8]/10 motion-reduce:transition-none';

interface HomeSectionsProps {
  onNavigate: (page: string) => void;
}

function Reveal({
  as,
  children,
  index,
  className,
}: {
  as: 'article' | 'li';
  children: ReactNode;
  index: number;
  className: string;
}) {
  const reduceMotion = useReducedMotion();
  const Component = motion[as];

  return (
    <Component
      className={className}
      initial={reduceMotion === false ? { opacity: 0, y: 12 } : false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      transition={{ duration: 0.35, delay: reduceMotion === false ? Math.min(index * 0.05, 0.2) : 0 }}
    >
      {children}
    </Component>
  );
}

function IconBadge({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#2283B8]/35 bg-[#003B5C] text-[#7dd3f5]">
      <Icon aria-hidden="true" size={22} />
    </span>
  );
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
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
            {relationshipExamples.map((item, index) => (
              <Reveal key={item.title} as="article" index={index} className={`${cardClass} flex items-start gap-4`}>
                <IconBadge icon={item.icon} />
                <div className="min-w-0">
                  <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                  <p className="mt-3 text-base leading-7 text-slate-200">{item.text}</p>
                </div>
              </Reveal>
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
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
            {configurationExamples.map((item, index) => (
              <Reveal key={item.title} as="article" index={index} className={`${cardClass} flex items-start gap-4`}>
                <IconBadge icon={item.icon} />
                <div className="min-w-0">
                  <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                  <p className="mt-3 text-base leading-7 text-slate-200">{item.text}</p>
                </div>
              </Reveal>
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
          <ol className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
            {gettingStartedSteps.map((step, index) => (
              <Reveal key={step.title} as="li" index={index} className={`${cardClass} flex items-start gap-4`}>
                <span
                  aria-hidden="true"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#2283B8]/35 bg-[#003B5C] text-lg font-bold text-[#7dd3f5]"
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="text-xl font-semibold text-white">{step.title}</h3>
                  <p className="mt-3 text-base leading-7 text-slate-200">{step.detail}</p>
                </div>
              </Reveal>
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
              <details
                key={item.question}
                className="rounded-xl border border-[#2283B8]/30 bg-[#001F33]/70 p-4 shadow-lg shadow-black/10 transition-[border-color,box-shadow] duration-200 open:border-[#2BB0E8]/55 hover:border-[#2BB0E8]/55 sm:p-5 motion-reduce:transition-none"
              >
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
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
            {additionalServices.map((service, index) => {
              const Icon = serviceIcons[service.id];
              return (
                <Reveal key={service.path} as="article" index={index} className={`${cardClass} flex h-full flex-col`}>
                  <div className="flex items-start gap-4">
                    <IconBadge icon={Icon} />
                    <h3 className="text-xl font-semibold text-white">{service.title}</h3>
                  </div>
                  <p className="mt-4 text-base leading-7 text-slate-200">{service.summary}</p>
                  <button
                    type="button"
                    onClick={() => onNavigate(service.path)}
                    className="mt-5 inline-flex min-h-11 items-center text-base font-semibold text-[#7dd3f5] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7dd3f5]"
                  >
                    View {service.title}
                  </button>
                </Reveal>
              );
            })}
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#packages"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#2283B8] px-5 py-3 text-base font-semibold text-white transition-colors duration-200 hover:bg-[#1b6d99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none"
            >
              Compare packages
            </a>
            <button
              type="button"
              onClick={() => onNavigate('contact')}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#2BB0E8] px-5 py-3 text-base font-semibold text-white transition-colors duration-200 hover:bg-[#2283B8]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none"
            >
              Discuss Your Business
            </button>
            <button
              type="button"
              onClick={() => onNavigate('portfolio')}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#2BB0E8] px-5 py-3 text-base font-semibold text-white transition-colors duration-200 hover:bg-[#2283B8]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none"
            >
              View project work
            </button>
          </div>
        </div>
      </section>
    </>
  );
};
