/** Legacy package retained for historical orders and admin copy only. Not sold in checkout. */
export const legacyBookingPackage = {
  id: 'booking-only',
  name: 'Starter Online Booking System Setup',
  priceDisplay: '$799',
  serviceLabel: 'Booking System Only — $799 (legacy)',
  scopeNote:
    'Legacy package. New purchases use the Business Website package. Existing booking-only workspaces keep booking without a generated website or CRM.',
} as const;

export const businessWebsitePackage = {
  id: 'business-website',
  name: 'Business Website',
  priceDisplay: '$799',
  serviceLabel: 'Business Website — $799',
  cta: 'Discuss My Website',
  scopeNote:
    'Automatically generated business website with structured editing and publishing. Booking and CRM are not included.',
  includes: [
    'Automatically generated business website',
    'Up to three pages',
    'Business information, services, contact details, and branding',
    'Website editor, preview, and publishing',
    '30-day support period after launch',
  ],
  kickoffNote:
    'Hosting after the included period, ongoing support, and generation usage limits are confirmed in writing before launch. Recurring billing is not enabled at checkout.',
} as const;

export const websiteSetupItems = [
  'Up to five mobile-friendly website pages',
  'Business information, services, contact details, and branding',
  'Contact form',
  'Basic SEO page titles and descriptions',
  'Platform-hosted public URL; custom domain connection scoped separately',
] as const;

export const websiteCrmPackage = {
  id: 'website-crm',
  name: 'Business Website + Booking + CRM',
  priceDisplay: '$1,499',
  serviceLabel: 'Website + Booking + CRM — $1,499',
  cta: 'Discuss My Website + CRM',
  hostingIntro: 'First 30 days of platform hosting included.',
  hostingThen: 'Continued hosting and support pricing is confirmed in writing before launch. Recurring billing is not enabled at checkout.',
  monthlyIncludes:
    'Ongoing hosting, support, and generation allowances are separate commercial terms and are not activated by the setup payment alone.',
  billingNote:
    'No subscription is started by package checkout. Any later recurring charge requires explicit consent.',
  limits:
    'One location, one staff calendar, up to 10 services, two users, 1,000 customer records, up to five website pages.',
  revision: 'Structured website edits inside the package page limit',
  training: 'One 30-minute training session',
  includes: [
    ...websiteSetupItems,
    'Website editor, preview, and publishing',
    'Customer records containing contact details, notes, tags, and booking history',
    'Lead stages for tracking inquiries through booking and completion',
    'Appointment availability and cancellation handling',
    'Appointment confirmations when email delivery is configured',
    'Configured database and access controls',
    'First 30 days of website, booking, CRM, and database hosting',
  ],
} as const;

/** @deprecated Use businessWebsitePackage. Kept as alias for gradual UI updates. */
export const bookingPackage = businessWebsitePackage;

export const additionalServices = [
  {
    id: 'cybersecurity',
    path: 'cybersecurity',
    title: 'Cybersecurity',
    summary: 'Security reviews, system hardening, and practical protection for business systems. Scoped separately from the website packages.',
  },
  {
    id: 'it-support',
    path: 'local-it-support',
    title: 'IT Support',
    summary: 'Help with networks, servers, backups, email, and day-to-day systems. Scoped separately from the website packages.',
  },
  {
    id: 'automation',
    path: 'automation-ai',
    title: 'Automation',
    summary: 'Workflow connections between the tools you already use. This is not included in the website packages.',
  },
] as const;

export const serviceInterests = [
  { id: businessWebsitePackage.id, label: businessWebsitePackage.serviceLabel },
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
    booking: businessWebsitePackage.priceDisplay,
    website: websiteCrmPackage.priceDisplay,
  },
  {
    label: 'What you receive',
    booking: 'Generated business website',
    website: 'Website, booking, and CRM',
  },
  {
    label: 'Business website',
    booking: 'Up to three pages',
    website: 'Up to five pages',
  },
  {
    label: 'Booking and CRM',
    booking: 'Not included',
    website: 'One calendar, customer records, notes, and booking history',
  },
  {
    label: 'Ongoing cost',
    booking: 'Confirmed in writing before launch. No subscription starts at checkout.',
    website: `${websiteCrmPackage.hostingIntro} ${websiteCrmPackage.hostingThen}`,
  },
] as const;

export const scopeFaqs = [
  {
    question: `What does the ${businessWebsitePackage.priceDisplay} package include?`,
    answer: `The ${businessWebsitePackage.priceDisplay} ${businessWebsitePackage.name} includes an automatically generated website with editor, preview, and publishing. Booking and CRM are not included.`,
  },
  {
    question: `What does the ${websiteCrmPackage.priceDisplay} package include?`,
    answer: `The ${websiteCrmPackage.priceDisplay} package includes a generated website, booking, and CRM.`,
  },
  {
    question: 'Is the domain name included?',
    answer: 'Domain registration is separate. The first release publishes to a unique platform URL. Custom domain connection is a later step.',
  },
  {
    question: 'Is this a fully custom build?',
    answer:
      'Packages generate and customize a curated website structure. Service names, branding, availability, page content, forms, and messages can be adapted within the agreed scope.',
  },
  {
    question: 'What needs a separate quote?',
    answer:
      'SMS, payment collection from end customers, bulk email, Gmail or Outlook synchronization, migrations, multiple calendars, and bespoke development are excluded and require a separate quote.',
  },
  {
    question: 'What happens after the first 30 days?',
    answer: `Continued hosted operation is confirmed in writing. ${websiteCrmPackage.monthlyIncludes} ${websiteCrmPackage.billingNote}`,
  },
  {
    question: 'What about older booking-only purchases?',
    answer:
      'Historical booking-only orders keep booking access without a generated website or CRM until an explicit upgrade is provisioned.',
  },
] as const;

export const gettingStartedSteps = [
  {
    title: 'Choose a package and continue to checkout.',
    detail: `The business website is ${businessWebsitePackage.priceDisplay}. The website with booking and CRM is ${websiteCrmPackage.priceDisplay}. Contact us first if the published scope does not fit.`,
  },
  {
    title: 'Send the business name and project requirements after payment is confirmed.',
    detail: 'Website customers also provide photos, wording, services, and branding preferences.',
  },
  {
    title: 'Accept the workspace invitation and generate the site.',
    detail: 'After provisioning, the owner sets up an account, completes business intake, and generates a draft website.',
  },
  {
    title: 'Preview, edit, and publish.',
    detail: 'Publish deliberately to a unique platform URL. Booking and CRM activate only for the Website + Booking + CRM package.',
  },
] as const;
