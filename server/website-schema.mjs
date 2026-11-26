/** Versioned website content schema for generated drafts. Schema version 1. */

export const WEBSITE_SCHEMA_VERSION = 1;

export const PAGE_TYPES = Object.freeze(['home', 'about', 'services', 'contact']);
export const SECTION_TYPES = Object.freeze([
  'hero',
  'about',
  'services_list',
  'contact_cta',
  'hours',
  'faq',
  'text',
]);

const HEX = /^#[0-9A-Fa-f]{6}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const INTERNAL_HREF = /^\/[A-Za-z0-9/_-]*$/;

function text(value, max, { required = false, min = 0 } = {}) {
  if (value == null || value === '') {
    if (required) throw Error('Invalid website content');
    return '';
  }
  if (typeof value !== 'string') throw Error('Invalid website content');
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) throw Error('Invalid website content');
  return trimmed;
}

function assertNoFabrication(value) {
  const blocked = /\b(testimonial|award-winning|guaranteed results|#1 rated|years of experience|licensed and insured)\b/i;
  if (blocked.test(value)) throw Error('Invalid website content');
}

function validateSection(section) {
  if (!section || typeof section !== 'object' || Array.isArray(section)) throw Error('Invalid website content');
  const type = text(section.type, 40, { required: true });
  if (!SECTION_TYPES.includes(type)) throw Error('Invalid website content');
  const id = text(section.id, 80, { required: true, min: 2 });
  if (!SLUG.test(id)) throw Error('Invalid website content');
  const title = text(section.title, 120);
  const body = text(section.body, 4000);
  const ctaLabel = text(section.ctaLabel, 80);
  const ctaHref = text(section.ctaHref, 200);
  if (ctaHref && !(INTERNAL_HREF.test(ctaHref) || ctaHref.startsWith('mailto:') || ctaHref.startsWith('tel:'))) {
    throw Error('Invalid website content');
  }
  assertNoFabrication(`${title}\n${body}`);
  const items = Array.isArray(section.items) ? section.items.slice(0, 12).map((item, index) => {
    if (!item || typeof item !== 'object') throw Error('Invalid website content');
    const name = text(item.name, 120, { required: true, min: 1 });
    const description = text(item.description, 800);
    assertNoFabrication(`${name}\n${description}`);
    return { name, description, key: text(item.key, 40) || `item-${index + 1}` };
  }) : [];
  return {
    id,
    type,
    title: title || undefined,
    body: body || undefined,
    ctaLabel: ctaLabel || undefined,
    ctaHref: ctaHref || undefined,
    items,
    hidden: section.hidden === true,
  };
}

function validatePage(page) {
  if (!page || typeof page !== 'object' || Array.isArray(page)) throw Error('Invalid website content');
  const type = text(page.type, 40, { required: true });
  if (!PAGE_TYPES.includes(type)) throw Error('Invalid website content');
  const slug = text(page.slug, 63, { required: true, min: 1 });
  if (type === 'home' ? slug !== 'home' : !SLUG.test(slug)) throw Error('Invalid website content');
  const title = text(page.title, 120, { required: true, min: 2 });
  const description = text(page.description, 320);
  assertNoFabrication(`${title}\n${description}`);
  if (!Array.isArray(page.sections) || page.sections.length < 1 || page.sections.length > 12) {
    throw Error('Invalid website content');
  }
  const sections = page.sections.map(validateSection);
  const ids = new Set(sections.map(section => section.id));
  if (ids.size !== sections.length) throw Error('Invalid website content');
  return {
    type,
    slug,
    title,
    description: description || undefined,
    sections,
  };
}

/**
 * Validates AI or fixture website content. Throws `Invalid website content` on failure.
 * @returns {{ schemaVersion: number, pages: object[], theme: object, navigation: object[], meta: object }}
 */
export function validateWebsiteContent(raw, { maxPages = 3 } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Invalid website content');
  const schemaVersion = Number(raw.schemaVersion ?? raw.schema_version ?? WEBSITE_SCHEMA_VERSION);
  if (schemaVersion !== WEBSITE_SCHEMA_VERSION) throw Error('Invalid website content');
  if (!Array.isArray(raw.pages) || raw.pages.length < 1 || raw.pages.length > maxPages) {
    throw Error('Invalid website content');
  }
  const pages = raw.pages.map(validatePage);
  const slugs = new Set(pages.map(page => page.slug));
  if (slugs.size !== pages.length) throw Error('Invalid website content');
  if (!pages.some(page => page.type === 'home' && page.slug === 'home')) throw Error('Invalid website content');

  const themeIn = raw.theme && typeof raw.theme === 'object' ? raw.theme : {};
  const primary = text(themeIn.primary, 7) || '#2283B8';
  const secondary = text(themeIn.secondary, 7) || '#0A0F1E';
  const font = text(themeIn.font, 80) || 'Source Sans 3';
  if (!HEX.test(primary) || !HEX.test(secondary)) throw Error('Invalid website content');

  const navigation = Array.isArray(raw.navigation)
    ? raw.navigation.slice(0, maxPages).map((item, index) => {
      const label = text(item?.label, 40, { required: true, min: 1 });
      const href = text(item?.href, 80, { required: true, min: 1 });
      if (!INTERNAL_HREF.test(href)) throw Error('Invalid website content');
      return { label, href, order: index };
    })
    : pages.map((page, index) => ({
      label: page.type === 'home' ? 'Home' : page.title.slice(0, 40),
      href: page.slug === 'home' ? '/' : `/${page.slug}`,
      order: index,
    }));

  const metaIn = raw.meta && typeof raw.meta === 'object' ? raw.meta : {};
  const metaTitle = text(metaIn.title, 120) || pages[0].title;
  const metaDescription = text(metaIn.description, 320) || pages[0].description || '';

  return {
    schemaVersion: WEBSITE_SCHEMA_VERSION,
    pages,
    theme: { primary, secondary, font },
    navigation,
    meta: { title: metaTitle, description: metaDescription },
    unfinished: Array.isArray(raw.unfinished)
      ? raw.unfinished.map(item => text(item, 120)).filter(Boolean).slice(0, 20)
      : [],
  };
}

export function fixtureWebsiteContent({ businessName, industry, description, maxPages = 3 }) {
  const name = text(businessName, 200, { required: true, min: 1 });
  const industryLabel = text(industry, 120) || 'local services';
  const summary = text(description, 800) || `${name} provides ${industryLabel} with clear communication and reliable scheduling.`;
  const pages = [
    {
      type: 'home',
      slug: 'home',
      title: name,
      description: summary.slice(0, 160),
      sections: [
        {
          id: 'hero',
          type: 'hero',
          title: name,
          body: summary,
          ctaLabel: 'Contact us',
          ctaHref: '/contact',
          items: [],
        },
        {
          id: 'about-teaser',
          type: 'about',
          title: `About ${name}`,
          body: `${name} focuses on ${industryLabel}. Content below is a labeled fixture draft for testing, not live AI output.`,
          items: [],
        },
      ],
    },
    {
      type: 'services',
      slug: 'services',
      title: 'Services',
      description: `Services offered by ${name}.`,
      sections: [
        {
          id: 'services',
          type: 'services_list',
          title: 'What we offer',
          body: 'Service details come from your business intake. Replace placeholder copy before publishing.',
          items: [
            { key: 'service-1', name: 'Primary service', description: 'Describe this service in intake before publishing.' },
            { key: 'service-2', name: 'Follow-up service', description: 'Add a short description customers will understand.' },
          ],
        },
      ],
    },
    {
      type: 'contact',
      slug: 'contact',
      title: 'Contact',
      description: `Contact ${name}.`,
      sections: [
        {
          id: 'contact',
          type: 'contact_cta',
          title: 'Get in touch',
          body: 'Use the contact details from your business profile. This fixture does not invent phone numbers or addresses.',
          ctaLabel: 'Send a message',
          ctaHref: '/contact',
          items: [],
        },
      ],
    },
  ].slice(0, Math.max(1, Math.min(maxPages, 3)));

  return validateWebsiteContent({
    schemaVersion: WEBSITE_SCHEMA_VERSION,
    pages,
    theme: { primary: '#2283B8', secondary: '#0A0F1E', font: 'Source Sans 3' },
    navigation: pages.map((page, index) => ({
      label: page.type === 'home' ? 'Home' : page.title,
      href: page.slug === 'home' ? '/' : `/${page.slug}`,
      order: index,
    })),
    meta: { title: name, description: summary.slice(0, 160) },
    unfinished: ['Fixture draft — replace with AI generation when GEMINI_API_KEY is configured.'],
  }, { maxPages });
}
