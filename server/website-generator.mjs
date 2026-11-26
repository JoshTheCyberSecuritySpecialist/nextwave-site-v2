import { createHash } from 'node:crypto';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { fixtureWebsiteContent, validateWebsiteContent, WEBSITE_SCHEMA_VERSION } from './website-schema.mjs';

const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDEMPOTENCY = /^[A-Za-z0-9_-]{16,80}$/;
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const MODELS = new Set([DEFAULT_MODEL, 'gemini-3.8-flash']);

const SYSTEM = [
  'You generate structured website copy for a small business on the Next Wave platform.',
  'Return one JSON object only.',
  'Use only supported page types: home, about, services, contact.',
  'Use only supported section types: hero, about, services_list, contact_cta, contact_form, hours, faq, text.',
  'Do not invent testimonials, awards, licenses, credentials, years in experience, prices, addresses, staff biographies, or customer counts.',
  'Do not include http or https links. CTA hrefs may be /, /about, /services, /contact, /book/{slug}, mailto:, or tel:.',
  'When a booking path is provided, prefer that path for the primary CTA and include a contact_form section on the contact page.',
  'Reflect only facts supplied in the business profile. Mark gaps in unfinished[].',
].join(' ');

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    schemaVersion: { type: Type.NUMBER },
    pages: { type: Type.ARRAY },
    theme: { type: Type.OBJECT },
    navigation: { type: Type.ARRAY },
    meta: { type: Type.OBJECT },
    unfinished: { type: Type.ARRAY },
  },
  required: ['schemaVersion', 'pages', 'theme', 'navigation', 'meta'],
};

function originOf(url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw Error('Invalid Supabase URL'); }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw Error('Invalid Supabase URL');
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) throw Error('Invalid Supabase URL');
  return parsed.origin;
}

function resolveModel(model) {
  if (model == null || model === '') return DEFAULT_MODEL;
  return typeof model === 'string' && MODELS.has(model) ? model : '';
}

function mappedError(body) {
  const text = body && typeof body.message === 'string' ? body.message : '';
  if (text.includes('unauthorized')) return 'Unauthorized';
  if (text.includes('website generation not enabled')) return 'Website generation is not included in this package.';
  if (text.includes('generation limit reached')) return 'Generation limit reached';
  if (text.includes('generation already in progress')) return 'Generation already in progress';
  if (text.includes('draft changed during generation')) return 'Draft changed during generation';
  if (text.includes('page limit exceeded')) return 'Page limit exceeded';
  if (text.includes('invalid generation')) return 'Invalid generation request';
  if (text.includes('website not found')) return 'Website not found';
  return '';
}

export async function generateWebsiteWithGemini(apiKey, prompt, model) {
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
      maxOutputTokens: 4000,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      thinkingConfig: { thinkingLevel: model === 'gemini-3.8-flash' ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL },
      abortSignal: AbortSignal.timeout(50_000),
      httpOptions: { timeout: 50_000, retryOptions: { attempts: 1 } },
    },
  });
  return response.text;
}

function parseGeneratedJson(raw) {
  const body = typeof raw === 'string' ? raw.trim() : '';
  if (!body) throw Error('Invalid generated content');
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw Error('Invalid generated content');
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    throw Error('Invalid generated content');
  }
}

function buildPrompt(profile, maxPages, bookingPath = '') {
  return [
    `Create a ${maxPages}-page business website draft as JSON.`,
    `schemaVersion must be ${WEBSITE_SCHEMA_VERSION}.`,
    `Business public name: ${profile.public_name}`,
    `Industry: ${profile.industry || 'not provided'}`,
    `Description: ${profile.description || 'not provided'}`,
    `Public email: ${profile.public_email || 'not provided'}`,
    `Public phone: ${profile.public_phone || 'not provided'}`,
    `Location: ${profile.location_text || 'not provided'}`,
    `Service area: ${profile.service_area || 'not provided'}`,
    `Primary CTA: ${profile.primary_cta_label || (bookingPath ? 'Book an appointment' : 'Contact us')}`,
    bookingPath ? `Booking path (use for primary CTA href): ${bookingPath}` : 'Booking is not included; use /contact and a contact_form section.',
    `Brand primary: ${profile.brand_primary || '#2283B8'}`,
    `Style direction: ${profile.style_direction || 'clean professional'}`,
    'Include a home page plus additional pages only when enough facts exist.',
    'Include a contact_form section on the contact page for working message submissions.',
    'Never fabricate missing contact details.',
  ].join('\n');
}

export function createWebsiteGenerator({
  url,
  serviceKey,
  apiKey = '',
  model = '',
  fetchImpl = fetch,
  complete,
  allowFixture = true,
}) {
  const origin = originOf(url);
  if (typeof serviceKey !== 'string' || serviceKey.length < 20) throw Error('Supabase service key required');
  const chosen = resolveModel(model);
  if (!chosen) throw Error('Invalid Gemini model');
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  async function identity(jwt) {
    if (typeof jwt !== 'string' || jwt.length > 4096 || !JWT.test(jwt) || jwt === serviceKey) throw Error('Unauthorized');
    const response = await fetchImpl(new URL('/auth/v1/user', origin), {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { apikey: serviceKey, Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
    });
    if (!response.ok) throw Error('Unauthorized');
    const user = await response.json();
    if (!user || typeof user.email !== 'string' || !UUID.test(user.id ?? '')) throw Error('Unauthorized');
    return { id: user.id, email: user.email.toLowerCase() };
  }

  async function rpc(name, args) {
    const response = await fetchImpl(new URL(`/rest/v1/rpc/${name}`, origin), {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000), headers, body: JSON.stringify(args),
    });
    if (!response.ok) {
      let body = null;
      try { body = await response.json(); } catch { body = null; }
      const mapped = mappedError(body);
      if (mapped) throw Error(mapped);
      throw Error('Database operation failed');
    }
    return response.json();
  }

  async function rest(path) {
    const response = await fetchImpl(new URL(path, origin), {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000), headers,
    });
    if (!response.ok) throw Error('Database operation failed');
    return response.json();
  }

  async function loadProfile(organizationId) {
    const rows = await rest(`/rest/v1/business_profiles?organization_id=eq.${organizationId}&select=*`);
    if (!Array.isArray(rows) || !rows[0]) throw Error('Complete business intake before generating a website.');
    return rows[0];
  }

  async function resolveBookingPath(organizationId, maxServices) {
    if (!(maxServices == null || maxServices > 0)) return '';
    const orgs = await rest(`/rest/v1/organizations?id=eq.${organizationId}&select=slug`);
    const slug = Array.isArray(orgs) ? orgs[0]?.slug : '';
    return typeof slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? `/book/${slug}` : '';
  }

  async function generateContent(profile, maxPages, bookingPath = '') {
    const prompt = buildPrompt(profile, maxPages, bookingPath);
    if (typeof complete === 'function') {
      const raw = await complete({ profile, maxPages, prompt, bookingPath });
      if (raw && typeof raw === 'object' && raw.fixture === true) {
        const content = validateWebsiteContent(raw.content, { maxPages });
        return { content, provider: 'fixture', fixture: true, providerRequestId: null };
      }
      const content = validateWebsiteContent(typeof raw === 'string' ? parseGeneratedJson(raw) : raw, { maxPages });
      return { content, provider: 'inject', fixture: false, providerRequestId: null };
    }
    if (!apiKey) {
      if (!allowFixture) throw Error('Website generation is not configured.');
      const content = fixtureWebsiteContent({
        businessName: profile.public_name,
        industry: profile.industry,
        description: profile.description,
        maxPages,
        bookingPath,
      });
      return {
        content,
        provider: 'fixture',
        fixture: true,
        providerRequestId: createHash('sha256').update(`fixture:${profile.organization_id}:${profile.public_name}`).digest('hex').slice(0, 32),
      };
    }
    let raw;
    try {
      raw = await generateWebsiteWithGemini(apiKey, prompt, chosen);
    } catch (error) {
      const status = error && typeof error === 'object' ? error.status : undefined;
      if (status === 429) throw Error('Gemini rate limit reached');
      throw Error('Gemini request failed');
    }
    const content = validateWebsiteContent(parseGeneratedJson(raw), { maxPages });
    return { content, provider: 'gemini', fixture: false, providerRequestId: null };
  }

  return {
    async status(jwt, organizationId) {
      const user = await identity(jwt);
      if (!UUID.test(organizationId ?? '')) throw Error('Invalid request');
      const membership = await rest(`/rest/v1/organization_members?organization_id=eq.${organizationId}&user_id=eq.${user.id}&status=eq.active&select=role`);
      if (!Array.isArray(membership) || !membership[0]) throw Error('Unauthorized');
      const entitlements = await rest(`/rest/v1/organization_entitlements?organization_id=eq.${organizationId}&select=website_enabled,max_pages,max_generation_runs`);
      const ent = Array.isArray(entitlements) ? entitlements[0] : null;
      if (!ent?.website_enabled) throw Error('Website generation is not included in this package.');
      const sites = await rest(`/rest/v1/websites?organization_id=eq.${organizationId}&select=id,slug,status,draft_revision_id,published_revision_id`);
      const site = Array.isArray(sites) ? sites[0] : null;
      const profiles = await rest(`/rest/v1/business_profiles?organization_id=eq.${organizationId}&select=public_name,intake_complete,industry,description`);
      const profile = Array.isArray(profiles) ? profiles[0] : null;
      const jobs = await rest(`/rest/v1/website_generation_jobs?organization_id=eq.${organizationId}&select=id,status,progress,error_message,provider,result_revision_id,created_at,finished_at&order=created_at.desc&limit=5`);
      const succeeded = await rest(`/rest/v1/website_generation_jobs?organization_id=eq.${organizationId}&status=eq.succeeded&select=id`);
      let draft = null;
      if (site?.draft_revision_id) {
        const revisions = await rest(`/rest/v1/website_revisions?id=eq.${site.draft_revision_id}&select=id,revision_number,schema_version,content,page_count,created_at`);
        draft = Array.isArray(revisions) ? revisions[0] : null;
      }
      return {
        organizationId,
        websiteEnabled: true,
        maxPages: ent.max_pages,
        maxGenerationRuns: ent.max_generation_runs,
        usedGenerationRuns: Array.isArray(succeeded) ? succeeded.length : 0,
        intakeComplete: profile?.intake_complete === true,
        profileName: profile?.public_name ?? null,
        website: site ? {
          id: site.id,
          slug: site.slug,
          status: site.status,
          draftRevisionId: site.draft_revision_id,
          publishedRevisionId: site.published_revision_id,
        } : null,
        draftRevision: draft ? {
          id: draft.id,
          revisionNumber: draft.revision_number,
          schemaVersion: draft.schema_version,
          pageCount: draft.page_count,
          content: draft.content,
          createdAt: draft.created_at,
        } : null,
        jobs: Array.isArray(jobs) ? jobs.map(job => ({
          id: job.id,
          status: job.status,
          progress: job.progress,
          errorMessage: job.error_message,
          provider: job.provider,
          resultRevisionId: job.result_revision_id,
          createdAt: job.created_at,
          finishedAt: job.finished_at,
        })) : [],
      };
    },

    async generate(jwt, organizationId, input = {}) {
      const user = await identity(jwt);
      if (!UUID.test(organizationId ?? '')) throw Error('Invalid request');
      const idempotencyKey = typeof input.idempotencyKey === 'string' ? input.idempotencyKey : '';
      if (!IDEMPOTENCY.test(idempotencyKey)) throw Error('Invalid generation request');
      const scope = input.scope === 'section' ? 'section' : 'full_site';
      const enqueued = await rpc('website_enqueue_generation', {
        p_organization_id: organizationId,
        p_user_id: user.id,
        p_idempotency_key: idempotencyKey,
        p_scope: scope,
        p_section_key: typeof input.sectionKey === 'string' ? input.sectionKey : null,
      });
      if (enqueued.duplicate === true && enqueued.status === 'succeeded') {
        return {
          jobId: enqueued.job_id,
          duplicate: true,
          status: enqueued.status,
          revisionId: null,
          fixture: false,
        };
      }
      if (enqueued.duplicate === true && enqueued.status !== 'queued') {
        return {
          jobId: enqueued.job_id,
          duplicate: true,
          status: enqueued.status,
          revisionId: null,
          fixture: false,
        };
      }
      await rpc('website_mark_generation_running', { p_job_id: enqueued.job_id });
      try {
        const profile = await loadProfile(organizationId);
        if (profile.intake_complete !== true) throw Error('Complete business intake before generating a website.');
        const maxPages = Number(enqueued.max_pages) || 3;
        const entitlements = await rest(`/rest/v1/organization_entitlements?organization_id=eq.${organizationId}&select=max_services`);
        const maxServices = Array.isArray(entitlements) ? entitlements[0]?.max_services : 0;
        const bookingPath = await resolveBookingPath(organizationId, maxServices);
        const generated = await generateContent(profile, maxPages, bookingPath);
        const applied = await rpc('website_apply_generation_result', {
          p_job_id: enqueued.job_id,
          p_content: generated.content,
          p_page_count: generated.content.pages.length,
          p_provider: generated.provider,
          p_provider_request_id: generated.providerRequestId,
          p_untrusted_fixture: generated.fixture === true,
        });
        return {
          jobId: enqueued.job_id,
          duplicate: applied.duplicate === true,
          status: applied.status,
          revisionId: applied.revision_id,
          revisionNumber: applied.revision_number,
          fixture: generated.fixture === true,
          provider: generated.provider,
          content: generated.content,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Generation failed';
        try {
          await rpc('website_fail_generation', { p_job_id: enqueued.job_id, p_error: message });
        } catch {
          // Preserve the original generation error.
        }
        throw error instanceof Error ? error : Error('Generation failed');
      }
    },
  };
}
