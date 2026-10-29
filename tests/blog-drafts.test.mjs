import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { completeWithGemini, createBlogDrafts } from '../server/blog-drafts.mjs';
import { productionServer, REQUIRED_PRODUCTION_ENV } from '../server/production-server.mjs';

const serviceKey = 'service-role-key-not-for-browser-use';
const adminJwt = 'header.payload.signature';
const requestId = '11111111-1111-4111-8111-111111111111';
const content = `# A booking page for a local business\n\n${'A clear explanation of the setup. '.repeat(30)}\n\n## What you receive\n\nThe booking package covers scheduling. The website package adds customer records.\n\n[Compare packages](/services)`;

function article() {
  return JSON.stringify({
    title: 'Booking pages for local businesses',
    excerpt: 'A practical look at what a small booking setup includes and what still needs a conversation.',
    content,
  });
}

function json(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test('blog drafts stay unpublished and reject unsafe generation', async () => {
  const calls = [];
  let completions = 0;
  const fetchImpl = async (url, options) => {
    const href = String(url);
    calls.push({ href, body: options.body });
    if (href.endsWith('/auth/v1/user')) {
      const email = options.headers.Authorization.endsWith(adminJwt) ? 'joshua@nextwavedigitalsolution.com' : 'other@example.com';
      return json({ email });
    }
    if (href.includes('/blog_posts?select=id')) return json([]);
    if (options.method === 'POST') {
      const saved = JSON.parse(options.body);
      assert.equal(saved.status, 'draft');
      assert.equal(saved.published_at, null);
      assert.equal(saved.author, 'NextWave Team');
      return json([{ ...saved, id: '22222222-2222-4222-8222-222222222222' }]);
    }
    return json([], 500);
  };
  const input = { topic: 'Online booking for a salon', keywords: 'booking', audience: 'salon owners', category: 'Web Development', length: 'short', requestId };
  const drafts = createBlogDrafts({
    url: 'https://example.supabase.co', serviceKey, apiKey: 'server-key', fetchImpl,
    complete: async () => { completions += 1; return article(); },
  });
  await assert.rejects(drafts.create('aa.bb.cc', input), /Unauthorized/);
  await assert.rejects(createBlogDrafts({ url: 'https://example.supabase.co', serviceKey, apiKey: '', fetchImpl, complete: async () => article() }).create(adminJwt, input), /not configured/);
  const saved = await drafts.create(adminJwt, input);
  assert.equal(saved.status, 'draft');
  assert.equal(completions, 1);
  const again = await drafts.create(adminJwt, input);
  assert.equal(again.id, saved.id);
  assert.equal(completions, 1);
  assert.equal(JSON.stringify(saved).includes(serviceKey), false);
  await assert.rejects(drafts.create(adminJwt, { ...input, requestId: '33333333-3333-4333-8333-333333333333', category: 'Not real' }), /Invalid draft request/);
  const failing = createBlogDrafts({
    url: 'https://example.supabase.co', serviceKey, apiKey: 'server-key', fetchImpl,
    complete: async () => { throw Error('upstream down'); },
  });
  await assert.rejects(failing.create(adminJwt, { ...input, requestId: '44444444-4444-4444-8444-444444444444' }), /Gemini request failed/);
  const limited = createBlogDrafts({
    url: 'https://example.supabase.co', serviceKey, apiKey: 'server-key', fetchImpl,
    complete: async () => { throw Object.assign(new Error('quota'), { status: 429 }); },
  });
  await assert.rejects(limited.create(adminJwt, { ...input, requestId: '88888888-8888-4888-8888-888888888888' }), /Gemini rate limit reached/);
  let modelCalls = 0;
  await assert.rejects(createBlogDrafts({
    url: 'https://example.supabase.co', serviceKey, apiKey: 'server-key', model: 'gemini-4-argon', fetchImpl,
    complete: async () => { modelCalls += 1; return article(); },
  }).create(adminJwt, { ...input, requestId: '99999999-9999-4999-8999-999999999999' }), /Invalid Gemini model/);
  assert.equal(modelCalls, 0);
  const unsafe = createBlogDrafts({
    url: 'https://example.supabase.co', serviceKey, apiKey: 'server-key', fetchImpl,
    complete: async () => JSON.stringify({ title: 'A study says 90 percent', excerpt: 'According to https://example.com this is guaranteed.', content: `${content}\nhttps://example.com` }),
  });
  await assert.rejects(unsafe.create(adminJwt, { ...input, requestId: '55555555-5555-4555-8555-555555555555' }), /Invalid generated content/);
  assert.equal(calls.some(call => call.href.includes('https://api.anthropic.com') || call.href.includes('generativelanguage.googleapis.com')), false);
  const seen = [];
  const generated = await completeWithGemini('server-key', 'Topic: booking', 1200, 'gemini-3.5-flash-lite', async (_key, _prompt, _max, model) => {
    seen.push(model);
    return ` ${article()} `;
  });
  assert.deepEqual(seen, ['gemini-3.5-flash-lite']);
  assert.equal(generated.startsWith('{'), true);
  await assert.rejects(completeWithGemini('server-key', 'Topic', 1200, 'gemini-2.5-flash', async () => { seen.push('fallback'); return article(); }), /Invalid Gemini model/);
  await assert.rejects(completeWithGemini('server-key', 'Topic', 1200, 'gemini-3.8-flash', async (_key, _prompt, _max, model) => {
    seen.push(model);
    throw Object.assign(new Error('quota'), { status: 429 });
  }), /Gemini rate limit reached/);
  assert.deepEqual(seen, ['gemini-3.5-flash-lite', 'gemini-3.8-flash']);
});

test('slug conflicts receive a suffix and the route stays admin-only', async () => {
  const fetchImpl = async (url, options) => {
    const href = String(url);
    if (href.endsWith('/auth/v1/user')) return json({ email: 'joshua@nextwavedigitalsolution.com' });
    if (href.includes('slug=eq.booking-pages-for-local-businesses&') || href.endsWith('slug=eq.booking-pages-for-local-businesses')) return json([{ id: 'taken' }]);
    if (href.includes('slug=eq.booking-pages-for-local-businesses-2')) return json([]);
    if (options.method === 'POST') {
      const saved = JSON.parse(options.body);
      assert.equal(saved.slug, 'booking-pages-for-local-businesses-2');
      return json([{ ...saved, id: '66666666-6666-4666-8666-666666666666' }]);
    }
    return json([], 500);
  };
  const drafts = createBlogDrafts({
    url: 'https://example.supabase.co', serviceKey, apiKey: 'server-key', fetchImpl,
    complete: async () => article(),
  });
  const saved = await drafts.create(adminJwt, { topic: 'Online booking for a salon', category: 'Web Development', length: 'standard', requestId: '77777777-7777-4777-8777-777777777777' });
  assert.equal(saved.slug, 'booking-pages-for-local-businesses-2');

  const server = productionServer({
    payments: { origin: 'http://127.0.0.1:5173', corsOrigins: ['http://127.0.0.1:5173'], async checkout() { return { ok: true }; } },
    drafts,
    env: {},
  });
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', error => error ? reject(error) : resolve()));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const origin = { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' };
    let response = await fetch(`${base}/api/admin/blog-drafts`, { method: 'POST', headers: origin, body: '{}' });
    assert.equal(response.status, 401);
    const blog = await readFile(new URL('../src/pages/Blog.tsx', import.meta.url), 'utf8');
    const admin = await readFile(new URL('../src/pages/BlogAdmin.tsx', import.meta.url), 'utf8');
    assert.match(blog, /\.eq\('status', 'published'\)/);
    assert.match(admin, /Generate with AI/);
    assert.match(admin, /value="published"/);
    assert.equal(admin.includes('ANTHROPIC_API_KEY'), false);
    assert.equal(admin.includes('GEMINI_API_KEY'), false);
    const serverSource = await readFile(new URL('../server/production-server.mjs', import.meta.url), 'utf8');
    const packageJson = await readFile(new URL('../package.json', import.meta.url), 'utf8');
    assert.match(serverSource, /GEMINI_API_KEY/);
    assert.equal(serverSource.includes('ANTHROPIC'), false);
    assert.equal(serverSource.includes('claude'), false);
    assert.equal(packageJson.includes('@google/genai'), true);
    assert.equal(packageJson.includes('@anthropic-ai/sdk'), false);
    assert.equal(REQUIRED_PRODUCTION_ENV.includes('GEMINI_API_KEY'), false);
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections?.(); });
  }
});
