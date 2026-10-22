export const bookingPackage = {
  id: 'booking-only',
  name: 'Starter Online Booking System Setup',
  priceDisplay: '$799',
  serviceLabel: 'Booking System Only — $799',
  cta: 'Discuss My Booking Setup',
  scopeNote:
    'This package covers the booking system only. A business website and full CRM are not included.',
  includes: [
    'Service setup',
    'Appointment availability',
    'Customer booking details collected during scheduling',
    'Appointment management',
    'Configuration around the agreed business requirements',
  ],
  kickoffNote:
    'Hosting, ongoing support costs, calendar and service limits, and integrations are confirmed in writing before work begins.',
} as const;

const websiteMonthlyAmount = 149;

export const websiteSetupItems = [
  'Up to five mobile-friendly website pages',
  'Customer-supplied logo, photos and wording',
  'Contact form',
  'Basic SEO page titles and descriptions',
  'Domain connection',
] as const;

export const websiteCrmPackage = {
  id: 'website-crm',
  name: 'Business Website + Booking + CRM',
  priceDisplay: '$1,499',
  serviceLabel: 'Website + Booking + CRM — $1,499',
  cta: 'Discuss My Website + CRM',
  monthlyDisplay: `$${websiteMonthlyAmount}/month`,
  hostingIntro: 'First 30 days of hosting included.',
  hostingThen: `Then $${websiteMonthlyAmount}/month for continued hosted operation.`,
  monthlyIncludes:
    'Monthly service includes hosting, routine platform and database maintenance, and up to one hour of combined support and small content changes.',
  billingNote:
    'No annual commitment. Recurring billing requires consent. Cancel before the next renewal; service ends after the paid period.',
  limits:
    'One location, one staff calendar, up to 10 services, two users, 1,000 customer records, one inbound email address and 1,000 combined sent and received emails per monthly service period.',
  revision: 'One consolidated revision round',
  training: 'One 30-minute training session',
  includes: [
    ...websiteSetupItems,
    'Customer records containing contact details, notes, tags, booking history and communications',
    'Lead stages for tracking inquiries through booking and completion',
    'Appointment availability and cancellation handling',
    'Appointment confirmations and one configurable reminder template',
    'Individual outbound customer emails and incoming replies through one configured domain email address',
    'Email conversations associated with customer records',
    'Follow-up tasks with due dates',
    'Dashboard showing new inquiries, upcoming appointments, unread messages and overdue tasks',
    'Configured database and access controls',
    'Basic customer contact CSV export',
    'One consolidated revision round',
    'One 30-minute training session',
    'First 30 days of website, CRM and database hosting',
  ],
} as const;

export const additionalServices = [
  {
    id: 'cybersecurity',
    path: 'cybersecurity',
    title: 'Cybersecurity',
    summary: 'Security reviews, system hardening, and practical protection for business systems. Scoped separately from the booking and website packages.',
  },
  {
    id: 'it-support',
    path: 'local-it-support',
    title: 'IT Support',
    summary: 'Help with networks, servers, backups, email, and day-to-day systems. Scoped separately from the booking and website packages.',
  },
  {
    id: 'automation',
    path: 'automation-ai',
    title: 'Automation',
    summary: 'Workflow connections between the tools you already use. This is not included in the booking system or website + CRM package.',
  },
] as const;

export const serviceInterests = [
  { id: bookingPackage.id, label: bookingPackage.serviceLabel },
  { id: websiteCrmPackage.id, label: websiteCrmPackage.serviceLabel },
  { id: 'cybersecurity', label: 'Cybersecurity' },
  { id: 'it-support', label: 'IT Support' },
  { id: 'automation', label: 'Automation' },
  { id: 'other', label: 'Other' },
] as const;

export type ServiceInterestId = (typeof serviceInterests)[number]['id'];

export const isServiceInterestId = (value: string | null): value is ServiceInterestId =>
  serviceInterests.some((item) => item.id === value);

export const serviceInterestLabel = (id: string) =>
  serviceInterests.find((item) => item.id === id)?.label ?? '';

export const contactPath = (serviceId?: string) => {
  if (!serviceId || !isServiceInterestId(serviceId)) {
    return '/contact';
  }

  return `/contact?service=${encodeURIComponent(serviceId)}`;
};

export const comparisonRows = [
  {
    label: 'Setup price',
    booking: bookingPackage.priceDisplay,
    website: websiteCrmPackage.priceDisplay,
  },
  {
    label: 'What you receive',
    booking: 'Booking system only',
    website: 'Website, booking, and CRM',
  },
  {
    label: 'Business website',
    booking: 'Not included',
    website: 'Up to five mobile-friendly pages',
  },
  {
    label: 'CRM',
    booking: 'Not included',
    website: 'Customer records, notes, messages, and follow-up tasks',
  },
  {
    label: 'Ongoing cost',
    booking: 'Confirmed in writing before work begins. No monthly CRM fee with this package.',
    website: `${websiteCrmPackage.hostingIntro} ${websiteCrmPackage.hostingThen}`,
  },
] as const;

export const scopeFaqs = [
  {
    question: `What does the ${bookingPackage.priceDisplay} package include?`,
    answer: `The ${bookingPackage.priceDisplay} ${bookingPackage.name} is booking only. A business website and full CRM are not included.`,
  },
  {
    question: `What does the ${websiteCrmPackage.priceDisplay} package include?`,
    answer: `The ${websiteCrmPackage.priceDisplay} package includes a website, booking, and CRM.`,
  },
  {
    question: 'Is the domain name included?',
    answer: 'Domain registration is separate. The website package includes connecting a domain you already have or register on your own.',
  },
  {
    question: 'Is this a fully custom build?',
    answer:
      'Packages customize an existing design and supported system configuration. Service names, branding, availability, page content, forms, and messages can be adapted within the agreed scope.',
  },
  {
    question: 'What needs a separate quote?',
    answer:
      'SMS, payment collection, bulk email, Gmail or Outlook synchronization, migrations, multiple calendars, and bespoke development are excluded and require a separate quote.',
  },
  {
    question: 'What happens after the first 30 days?',
    answer: `Continued hosted operation for the website + CRM package is ${websiteCrmPackage.monthlyDisplay} after the first 30 days. ${websiteCrmPackage.monthlyIncludes} ${websiteCrmPackage.billingNote}`,
  },
  {
    question: 'How is booking-only hosting handled?',
    answer:
      'Booking-only hosting and support costs are confirmed before kickoff. They are not the website + CRM monthly fee.',
  },
] as const;

export const gettingStartedSteps = [
  {
    title: 'Choose a package and continue to checkout.',
    detail: `The booking setup is ${bookingPackage.priceDisplay}. The website with booking and CRM is ${websiteCrmPackage.priceDisplay}. Contact us first if the published scope does not fit.`,
  },
  {
    title: 'Send the business name and project requirements after payment is confirmed.',
    detail: 'Website customers also provide photos, wording, services, and availability.',
  },
  {
    title: 'Review the configured setup.',
    detail: `The website + CRM package includes ${websiteCrmPackage.revision.toLowerCase()} and ${websiteCrmPackage.training.toLowerCase()}.`,
  },
  {
    title: 'Launch the agreed setup.',
    detail: 'We launch the setup that was confirmed. Timing depends on the materials and access you provide.',
  },
] as const;
