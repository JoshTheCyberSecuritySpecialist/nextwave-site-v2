import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const ADMIN_EMAIL = 'joshua@nextwavedigitalsolution.com';
const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORIES = ['Web Development', 'Cybersecurity', 'AI Automation', 'IT Support', 'Case Studies'];
const LENGTHS = { short: 1200, standard: 2500, long: 4000 };
const LINKS = new Set(['/', '/services', '/contact', '/web-development', '/cybersecurity', '/automation-ai', '/local-it-support']);
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const MODELS = new Set([DEFAULT_MODEL, 'gemini-3.8-flash']);
const SYSTEM = 'You write draft blog posts for Next Wave Digital Solutions. Return one JSON object and no other text. Do not invent statistics, testimonials, awards, guarantees, or external citations. Do not include http or https links. Internal links may use only /, /services, /contact, /web-development, /cybersecurity, /automation-ai, and /local-it-support.';
const KEPT = new Set(['Invalid generated content', 'Gemini rate limit reached', 'Gemini request failed', 'Invalid Gemini model', 'AI drafting is not configured.']);

function originOf(url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw Error('Invalid Supabase URL'); }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw Error('Invalid Supabase URL');
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) throw Error('Invalid Supabase URL');
  return parsed.origin;
}

function text(value, max) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : '';
}

function slugify(title) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/g, '');
  if (slug.length < 3) throw Error('Invalid generated content');
  return slug;
}

function resolveModel(model) {
  if (model == null || model === '') return DEFAULT_MODEL;
  return typeof model === 'string' && MODELS.has(model) ? model : '';
}

function asDraftError(error) {
  if (error instanceof Error && KEPT.has(error.message)) throw error;
  const status = error && typeof error === 'object' ? error.status : undefined;
  if (status === 429) throw Error('Gemini rate limit reached');
  throw Error('Gemini request failed');
}

function articleFrom(raw, category) {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw Error('Invalid generated content');
  let article;
  try { article = JSON.parse(raw.slice(start, end + 1)); } catch { throw Error('Invalid generated content'); }
  const title = text(article.title, 140);
  const excerpt = text(article.excerpt, 320);
  const content = text(article.content, 20000);
  if (title.length < 8 || excerpt.length < 40 || content.length < 400 || !/^#{1,3} /m.test(content)) throw Error('Invalid generated content');
  if (/https?:\/\//i.test(`${title}\n${excerpt}\n${content}`)) throw Error('Invalid generated content');
  for (const match of content.matchAll(/\]\(([^)\s]+)\)/g)) {
    const path = match[1].split(/[?#]/)[0];
    if (!LINKS.has(path)) throw Error('Invalid generated content');
  }
  return { title, excerpt, content, category, slug: slugify(title) };
}

export async function generateWithGemini(apiKey, prompt, maxTokens, model) {
  const ai = new GoogleGenAI({
    apiKey,
    vertexai: false,
    httpOptions: { timeout: 50_000, retryOptions: { attempts: 1 } },
  });
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM,
      maxOutputTokens: maxTokens,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          excerpt: { type: Type.STRING },
          content: { type: Type.STRING },
        },
        required: ['title', 'excerpt', 'content'],
      },
      thinkingConfig: { thinkingLevel: model === 'gemini-3.8-flash' ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL },
      abortSignal: AbortSignal.timeout(50_000),
      httpOptions: { timeout: 50_000, retryOptions: { attempts: 1 } },
    },
  });
  return response.text;
}

export async function completeWithGemini(apiKey, prompt, maxTokens, model = DEFAULT_MODEL, generate = generateWithGemini) {
  if (!MODELS.has(model)) throw Error('Invalid Gemini model');
  let raw;
  try {
    raw = await generate(apiKey, prompt, maxTokens, model);
  } catch (error) {
    asDraftError(error);
  }
  const body = typeof raw === 'string' ? raw.trim() : '';
  if (!body) throw Error('Gemini request failed');
  return body;
}

export function createBlogDrafts({ url, serviceKey, apiKey = '', model = '', fetchImpl = fetch, complete, adminEmail = ADMIN_EMAIL, now = Date.now }) {
  const origin = originOf(url);
  if (typeof serviceKey !== 'string' || serviceKey.length < 20) throw Error('Supabase service key required');
  const chosen = resolveModel(model);
  const completeDraft = complete ?? ((key, prompt, maxTokens) => completeWithGemini(key, prompt, maxTokens, chosen));
  const saved = new Map();
  const calls = [];
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: 'application/json' };

  async function caller(jwt) {
    if (typeof jwt !== 'string' || jwt.length > 4096 || !JWT.test(jwt) || jwt === serviceKey) throw Error('Unauthorized');
    const response = await fetchImpl(new URL('/auth/v1/user', origin), {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { ...headers, Authorization: `Bearer ${jwt}` },
    });
    if (!response.ok) throw Error('Unauthorized');
    const user = await response.json();
    if (!user || typeof user.email !== 'string' || user.email.toLowerCase() !== adminEmail) throw Error('Unauthorized');
    return user.email.toLowerCase();
  }

  async function rest(path, options = {}) {
    const response = await fetchImpl(new URL(path, origin), {
      method: options.method ?? 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { ...headers, ...options.headers },
      body: options.body,
    });
    if (!response.ok) throw Error('Database operation failed');
    return response.json();
  }

  async function openSlug(base) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const slug = attempt === 0 ? base : `${base.slice(0, 76)}-${attempt + 1}`;
      const rows = await rest(`/rest/v1/blog_posts?select=id&slug=eq.${encodeURIComponent(slug)}`);
      if (!Array.isArray(rows)) throw Error('Invalid database result');
      if (rows.length === 0) return slug;
    }
    throw Error('Invalid generated content');
  }

  return {
    async create(jwt, input) {
      const email = await caller(jwt);
      const topic = text(input?.topic, 200);
      const keywords = text(input?.keywords, 200);
      const audience = text(input?.audience, 160);
      const category = CATEGORIES.includes(input?.category) ? input.category : '';
      const requestId = typeof input?.requestId === 'string' ? input.requestId : '';
      const maxTokens = LENGTHS[input?.length];
      if (topic.length < 8 || !category || !REQUEST_ID.test(requestId) || !maxTokens) throw Error('Invalid draft request');
      if (saved.has(requestId)) return saved.get(requestId);
      const recent = calls.filter(call => call.email === email && now() - call.at < 3600000);
      if (recent.length >= 8) throw Error('Generation limit reached');
      if (!apiKey) throw Error('AI drafting is not configured.');
      if (!chosen) throw Error('Invalid Gemini model');
      calls.push({ email, at: now() });
      let raw;
      try {
        raw = await completeDraft(apiKey, [
          `Topic: ${topic}`,
          keywords ? `Keywords to use naturally: ${keywords}` : '',
          audience ? `Audience: ${audience}` : '',
          `Category: ${category}`,
          'Write for a small business owner.',
          'Services that may be mentioned: booking setup, a business website, customer records, and follow-up the business handles itself.',
          'Return JSON with title, excerpt, and content. content must be markdown with headings and a closing call to action.',
        ].filter(Boolean).join('\n'), maxTokens);
      } catch (error) {
        asDraftError(error);
      }
      const article = articleFrom(raw, category);
      const slug = await openSlug(article.slug);
      const readTime = Math.min(30, Math.max(1, Math.round(article.content.split(/\s+/).length / 200)));
      const inserted = await rest('/rest/v1/blog_posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({
          title: article.title,
          slug,
          excerpt: article.excerpt,
          content: article.content,
          category,
          author: 'NextWave Team',
          status: 'draft',
          published_at: null,
          read_time: readTime,
          featured_image: null,
        }),
      });
      const row = Array.isArray(inserted) ? inserted[0] : null;
      if (!row || row.status !== 'draft' || typeof row.id !== 'string') throw Error('Database operation failed');
      const draft = {
        id: row.id,
        title: row.title,
        slug: row.slug,
        excerpt: row.excerpt,
        content: row.content,
        category: row.category,
        author: row.author,
        status: 'draft',
        readTime: row.read_time,
      };
      saved.set(requestId, draft);
      return draft;
    },
  };
}
