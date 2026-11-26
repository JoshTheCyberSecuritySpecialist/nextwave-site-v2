import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWebsiteContent } from '../server/website-schema.mjs';
import {
  applyLook,
  insertSection,
  moveSectionBy,
  patchSection,
  placeholderKey,
  removeSection,
} from '../src/lib/website-sections.mjs';

function siteWithHeroAndServices() {
  return validateWebsiteContent({
    schemaVersion: 1,
    pages: [{
      type: 'home',
      slug: 'home',
      title: 'Harbor Dental',
      description: 'Family dentistry with clear scheduling.',
      sections: [
        {
          id: 'hero',
          type: 'hero',
          title: 'Harbor Dental',
          body: 'Family dentistry with clear scheduling and practical aftercare.',
          ctaLabel: 'Contact us',
          ctaHref: '/contact',
          items: [],
        },
        {
          id: 'services',
          type: 'services_list',
          title: 'What we offer',
          body: 'Care for local patients.',
          items: [{ key: 'cleanings', name: 'Cleanings', description: 'Routine visits for local patients.' }],
        },
      ],
    }],
    theme: { primary: '#2283B8', secondary: '#0A0F1E', font: 'Source Sans 3' },
    navigation: [{ label: 'Home', href: '/' }],
    meta: { title: 'Harbor Dental', description: 'Family dentistry with clear scheduling.' },
    unfinished: ['Fixture draft stays until generation replaces it.'],
  }, { maxPages: 3 });
}

test('dragging an FAQ between hero and services keeps the edit after validation', () => {
  const published = siteWithHeroAndServices();
  const inserted = insertSection(published, 'home', 1, 'faq');
  const faqId = inserted.sectionId;
  assert.deepEqual(inserted.content.pages[0].sections.map(section => section.type), ['hero', 'faq', 'services_list']);
  assert.ok(inserted.content.unfinished.includes(placeholderKey(faqId)));
  assert.ok(inserted.content.unfinished.some(item => /Fixture draft/.test(item)));

  const edited = patchSection(inserted.content, 'home', faqId, {
    title: 'Questions from patients',
    body: 'Answers the front desk can stand behind.',
    items: [{ key: 'question-1', name: 'Do you take new patients?', description: 'Yes. Call the office and we will find the next opening.' }],
  });
  const saved = validateWebsiteContent(edited, { maxPages: 3 });

  assert.equal(saved.pages[0].sections[1].id, faqId);
  assert.equal(saved.pages[0].sections[1].type, 'faq');
  assert.equal(saved.pages[0].sections[1].items[0].name, 'Do you take new patients?');
  assert.equal(saved.pages[0].sections[1].items[0].description, 'Yes. Call the office and we will find the next opening.');
  assert.equal(saved.unfinished.includes(placeholderKey(faqId)), false);
  assert.deepEqual(published.pages[0].sections.map(section => section.type), ['hero', 'services_list']);
});

test('Add section here and Move up use the same section order', () => {
  const start = siteWithHeroAndServices();
  const added = insertSection(start, 'home', 2, 'faq');
  const moved = moveSectionBy(added.content, 'home', added.sectionId, -1);
  assert.deepEqual(moved.pages[0].sections.map(section => section.type), ['hero', 'faq', 'services_list']);
  assert.throws(() => removeSection({
    ...moved,
    pages: [{ ...moved.pages[0], sections: [moved.pages[0].sections[0]] }],
  }, 'home', 'hero'), /at least one section/);
});

test('a starter look can update colors without replacing sections', () => {
  const start = siteWithHeroAndServices();
  const colorsOnly = applyLook(start, 'studio', { replaceSections: false });
  assert.equal(colorsOnly.theme.primary, '#08C6CC');
  assert.equal(colorsOnly.theme.secondary, '#070909');
  assert.deepEqual(colorsOnly.pages[0].sections.map(section => section.id), ['hero', 'services']);

  const replaced = applyLook(start, 'charter', { replaceSections: true });
  assert.equal(replaced.theme.primary, '#00CFFF');
  assert.equal(replaced.theme.secondary, '#020617');
  assert.deepEqual(replaced.pages[0].sections.map(section => section.type), ['hero', 'steps', 'services_list', 'hours', 'faq', 'contact_cta']);
  assert.ok(replaced.unfinished.some(item => item.startsWith('placeholder:')));
  assert.equal(validateWebsiteContent(replaced, { maxPages: 3 }).pages[0].sections.length, 6);
});
