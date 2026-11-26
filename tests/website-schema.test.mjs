import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureWebsiteContent, validateWebsiteContent, WEBSITE_SCHEMA_VERSION } from '../server/website-schema.mjs';

test('fixture content validates within page limits', () => {
  const content = fixtureWebsiteContent({
    businessName: 'Harbor Dental',
    industry: 'dentistry',
    description: 'Family dentistry with clear scheduling and practical aftercare guidance for local patients.',
    maxPages: 3,
  });
  assert.equal(content.schemaVersion, WEBSITE_SCHEMA_VERSION);
  assert.ok(content.pages.length <= 3);
  assert.ok(content.pages.some(page => page.slug === 'home'));
  assert.ok(content.unfinished.some(item => /fixture/i.test(item)));
});

test('validation rejects fabricated testimonials and oversized page counts', () => {
  const good = fixtureWebsiteContent({ businessName: 'Pine Plumbing', description: 'Residential plumbing repairs and maintenance for nearby neighborhoods with clear estimates.', maxPages: 3 });
  assert.throws(() => validateWebsiteContent({ ...good, pages: [...good.pages, ...good.pages] }, { maxPages: 3 }), /Invalid website content/);
  const bad = structuredClone(good);
  bad.pages[0].sections[0].body = 'We are award-winning and have glowing testimonials from hundreds of customers.';
  assert.throws(() => validateWebsiteContent(bad, { maxPages: 3 }), /Invalid website content/);
});
