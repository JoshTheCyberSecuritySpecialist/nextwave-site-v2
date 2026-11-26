/** Whole-section editing for the website studio. Schema version 1. */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const INTERNAL_HREF = /^\/[A-Za-z0-9/_-]*$/;
const BLOCKED = /\b(testimonial|award-winning|guaranteed results|#1 rated|years of experience|licensed and insured)\b/i;
const PLACEHOLDER_PREFIX = 'placeholder:';

const EXAMPLE_COPY = new Set([
  'Your headline',
  'Replace this example sentence with what you want visitors to know.',
  'Example services',
  'Replace this example with a short note about what you offer.',
  'Example service',
  'Replace this example description.',
  'Example questions',
  'Replace these example questions before you publish.',
  'Example question',
  'Replace this example answer.',
  'Example steps',
  'Replace this example with how a customer gets started.',
  'Example step',
  'Example hours',
  'Replace this example with when you are open.',
  'Example day',
  'Example about',
  'Replace this example with who you are and what you do.',
  'Example text',
  'Replace this example with the details you want on the page.',
  'Example next step',
  'Replace this example with what you want visitors to do next.',
  'Example button',
  'Example message',
  'Replace this example with how you want visitors to reach you.',
]);

export const LIBRARY = Object.freeze([
  { type: 'hero', label: 'Hero', blurb: 'Headline and one call to action' },
  { type: 'services_list', label: 'Services', blurb: 'A grid of what you offer' },
  { type: 'faq', label: 'FAQ', blurb: 'Questions and answers' },
  { type: 'steps', label: 'Steps', blurb: 'A numbered how-it-works list' },
  { type: 'hours', label: 'Hours', blurb: 'Days and opening times' },
  { type: 'about', label: 'About', blurb: 'Who you are' },
  { type: 'text', label: 'Text', blurb: 'A heading and a paragraph' },
  { type: 'contact_cta', label: 'Call to action', blurb: 'A closing prompt and button' },
  { type: 'contact_form', label: 'Contact form', blurb: 'A message form for the business inbox' },
]);

export const LOOKS = Object.freeze([
  {
    id: 'neutral',
    label: 'Neutral',
    primary: '#2283B8',
    secondary: '#0A0F1E',
    font: 'Source Sans 3',
    stack: ['hero', 'services_list', 'faq'],
  },
  {
    id: 'studio',
    label: 'Studio',
    primary: '#08C6CC',
    secondary: '#070909',
    font: 'Source Sans 3',
    stack: ['hero', 'steps', 'services_list', 'faq', 'contact_form'],
  },
  {
    id: 'charter',
    label: 'Charter',
    primary: '#00CFFF',
    secondary: '#020617',
    font: 'Source Sans 3',
    stack: ['hero', 'steps', 'services_list', 'hours', 'faq', 'contact_cta'],
  },
]);

const ITEM_FIELDS = {
  faq: { name: 'Question', description: 'Answer', add: 'Add question' },
  services_list: { name: 'Service', description: 'Description', add: 'Add service' },
  steps: { name: 'Step', description: 'Details', add: 'Add step' },
  hours: { name: 'Day', description: 'Hours', add: 'Add day' },
};

function clone(content) {
  return structuredClone(content);
}

function libraryEntry(type) {
  return LIBRARY.find(entry => entry.type === type) ?? null;
}

export function libraryLabel(type) {
  return libraryEntry(type)?.label || 'Section';
}

export function itemFields(type) {
  return ITEM_FIELDS[type] ?? null;
}

export function placeholderKey(sectionId) {
  return `${PLACEHOLDER_PREFIX}${sectionId}`;
}

function usedIds(content) {
  const ids = new Set();
  for (const page of content.pages || []) {
    for (const section of page.sections || []) ids.add(section.id);
  }
  return ids;
}

function uniqueSectionId(type, content) {
  const used = usedIds(content);
  const prefix = type.replaceAll('_', '-');
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const id = `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
    if (SLUG.test(id) && !used.has(id)) return id;
  }
  throw Error('Could not create a section id.');
}

function item(key, name, description) {
  return { key, name, description };
}

export function createStarterSection(type, id) {
  if (!libraryEntry(type)) throw Error('Unknown section.');
  if (type === 'hero') {
    return {
      id,
      type,
      title: 'Your headline',
      body: 'Replace this example sentence with what you want visitors to know.',
      ctaLabel: 'Get in touch',
      ctaHref: '/contact',
      items: [],
      hidden: false,
    };
  }
  if (type === 'services_list') {
    return {
      id,
      type,
      title: 'Example services',
      body: 'Replace this example with a short note about what you offer.',
      items: [
        item('service-1', 'Example service', 'Replace this example description.'),
        item('service-2', 'Example service', 'Replace this example description.'),
      ],
      hidden: false,
    };
  }
  if (type === 'faq') {
    return {
      id,
      type,
      title: 'Example questions',
      body: 'Replace these example questions before you publish.',
      items: [item('question-1', 'Example question', 'Replace this example answer.')],
      hidden: false,
    };
  }
  if (type === 'steps') {
    return {
      id,
      type,
      title: 'Example steps',
      body: 'Replace this example with how a customer gets started.',
      items: [
        item('step-1', 'Example step', 'Replace this example description.'),
        item('step-2', 'Example step', 'Replace this example description.'),
      ],
      hidden: false,
    };
  }
  if (type === 'hours') {
    return {
      id,
      type,
      title: 'Example hours',
      body: 'Replace this example with when you are open.',
      items: [item('day-1', 'Example day', 'Example hours')],
      hidden: false,
    };
  }
  if (type === 'about') {
    return {
      id,
      type,
      title: 'Example about',
      body: 'Replace this example with who you are and what you do.',
      items: [],
      hidden: false,
    };
  }
  if (type === 'contact_cta') {
    return {
      id,
      type,
      title: 'Example next step',
      body: 'Replace this example with what you want visitors to do next.',
      ctaLabel: 'Example button',
      ctaHref: '/contact',
      items: [],
      hidden: false,
    };
  }
  if (type === 'contact_form') {
    return {
      id,
      type,
      title: 'Example message',
      body: 'Replace this example with how you want visitors to reach you.',
      items: [],
      hidden: false,
    };
  }
  return {
    id,
    type: 'text',
    title: 'Example text',
    body: 'Replace this example with the details you want on the page.',
    items: [],
    hidden: false,
  };
}

export function blankItem(type, index) {
  if (type === 'faq') return item(`question-${index}`, 'Example question', 'Replace this example answer.');
  if (type === 'hours') return item(`day-${index}`, 'Example day', 'Example hours');
  if (type === 'steps') return item(`step-${index}`, 'Example step', 'Replace this example description.');
  return item(`item-${index}`, 'Example service', 'Replace this example description.');
}

function sectionCopy(section) {
  return [
    section?.title,
    section?.body,
    section?.ctaLabel,
    ...(Array.isArray(section?.items) ? section.items.flatMap(entry => [entry?.name, entry?.description]) : []),
  ].filter(value => typeof value === 'string' && value.trim());
}

export function sectionUsesExampleCopy(section) {
  return sectionCopy(section).some(value => EXAMPLE_COPY.has(value.trim()));
}

export function syncPlaceholders(content) {
  const next = content;
  const active = new Set();
  for (const page of next.pages || []) {
    for (const section of page.sections || []) {
      if (sectionUsesExampleCopy(section)) active.add(placeholderKey(section.id));
    }
  }
  const kept = (Array.isArray(next.unfinished) ? next.unfinished : [])
    .filter(itemText => typeof itemText === 'string' && (!itemText.startsWith(PLACEHOLDER_PREFIX) || active.has(itemText)));
  for (const key of active) {
    if (!kept.includes(key)) kept.push(key);
  }
  next.unfinished = kept.slice(0, 20);
  return next;
}

export function unfinishedLabel(content, itemText) {
  if (typeof itemText !== 'string' || !itemText.startsWith(PLACEHOLDER_PREFIX)) return String(itemText ?? '');
  const id = itemText.slice(PLACEHOLDER_PREFIX.length);
  const pages = Array.isArray(content?.pages) ? content.pages : [];
  for (const page of pages) {
    const section = (page.sections || []).find(entry => entry.id === id);
    if (section) {
      const label = section.title || libraryLabel(section.type);
      return `Replace the example text in "${label}" before publishing.`;
    }
  }
  return 'Replace example text before publishing.';
}

function pageOf(content, pageSlug) {
  const page = (content.pages || []).find(entry => entry.slug === pageSlug);
  if (!page) throw Error('Page not found.');
  return page;
}

export function insertSection(content, pageSlug, index, type) {
  if (!libraryEntry(type)) throw Error('Unknown section.');
  const next = clone(content);
  const page = pageOf(next, pageSlug);
  if (page.sections.length >= 12) throw Error('This page already has 12 sections.');
  const id = uniqueSectionId(type, next);
  const section = createStarterSection(type, id);
  const at = Math.max(0, Math.min(Number(index) || 0, page.sections.length));
  page.sections.splice(at, 0, section);
  return { content: syncPlaceholders(next), sectionId: id };
}

export function moveSection(content, pageSlug, sectionId, toIndex) {
  const next = clone(content);
  const page = pageOf(next, pageSlug);
  const from = page.sections.findIndex(section => section.id === sectionId);
  if (from < 0) throw Error('Section not found.');
  if (toIndex === from || toIndex === from + 1) return content;
  const [section] = page.sections.splice(from, 1);
  const index = toIndex > from ? toIndex - 1 : toIndex;
  const at = Math.max(0, Math.min(index, page.sections.length));
  page.sections.splice(at, 0, section);
  return syncPlaceholders(next);
}

export function moveSectionBy(content, pageSlug, sectionId, direction) {
  const page = pageOf(content, pageSlug);
  const index = page.sections.findIndex(section => section.id === sectionId);
  if (index < 0) throw Error('Section not found.');
  if (direction < 0 && index === 0) return content;
  if (direction > 0 && index === page.sections.length - 1) return content;
  const toIndex = direction < 0 ? index - 1 : index + 2;
  return moveSection(content, pageSlug, sectionId, toIndex);
}

export function removeSection(content, pageSlug, sectionId) {
  const next = clone(content);
  const page = pageOf(next, pageSlug);
  if (page.sections.length <= 1) throw Error('A page needs at least one section.');
  const index = page.sections.findIndex(section => section.id === sectionId);
  if (index < 0) throw Error('Section not found.');
  page.sections.splice(index, 1);
  return syncPlaceholders(next);
}

export function patchSection(content, pageSlug, sectionId, patch) {
  const next = clone(content);
  const section = pageOf(next, pageSlug).sections.find(entry => entry.id === sectionId);
  if (!section) throw Error('Section not found.');
  if (Object.prototype.hasOwnProperty.call(patch, 'title')) section.title = patch.title;
  if (Object.prototype.hasOwnProperty.call(patch, 'body')) section.body = patch.body;
  if (Object.prototype.hasOwnProperty.call(patch, 'ctaLabel')) section.ctaLabel = patch.ctaLabel;
  if (Object.prototype.hasOwnProperty.call(patch, 'ctaHref')) section.ctaHref = patch.ctaHref;
  if (Object.prototype.hasOwnProperty.call(patch, 'hidden')) section.hidden = patch.hidden === true;
  if (Array.isArray(patch.items)) {
    if (patch.items.length > 12) throw Error('A section can have 12 items.');
    section.items = patch.items.map((entry, index) => ({
      key: typeof entry.key === 'string' && entry.key.trim() ? entry.key.trim().slice(0, 40) : `item-${index + 1}`,
      name: typeof entry.name === 'string' ? entry.name : '',
      description: typeof entry.description === 'string' ? entry.description : '',
    }));
  }
  return syncPlaceholders(next);
}

export function applyLook(content, lookId, { replaceSections = false } = {}) {
  const look = LOOKS.find(entry => entry.id === lookId);
  if (!look) throw Error('Unknown look.');
  const next = clone(content);
  next.theme = { ...(next.theme || {}), primary: look.primary, secondary: look.secondary, font: look.font };
  if (replaceSections) {
    const home = pageOf(next, 'home');
    home.sections = [];
    for (const type of look.stack) {
      const id = uniqueSectionId(type, next);
      home.sections.push(createStarterSection(type, id));
    }
  }
  return syncPlaceholders(next);
}

export function assertDraftReady(content) {
  for (const page of content.pages || []) {
    for (const section of page.sections || []) {
      const href = section.ctaHref || '';
      if (href && !(INTERNAL_HREF.test(href) || href.startsWith('mailto:') || href.startsWith('tel:'))) {
        throw Error('Use a site path, email link, or phone link.');
      }
      const copy = sectionCopy(section).join('\n');
      if (BLOCKED.test(copy)) throw Error('Remove claims the site cannot verify before saving.');
      for (const entry of section.items || []) {
        if (!String(entry.name || '').trim()) throw Error('Each item needs a name.');
      }
    }
  }
}
