import { validateWebsiteContent } from './website-schema.mjs';

const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function originOf(url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw Error('Invalid Supabase URL'); }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw Error('Invalid Supabase URL');
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) throw Error('Invalid Supabase URL');
  return parsed.origin;
}

function mappedError(body) {
  const text = body && typeof body.message === 'string' ? body.message : '';
  if (text.includes('unauthorized')) return 'Unauthorized';
  if (text.includes('website not enabled')) return 'Website publishing is not included in this package.';
  if (text.includes('website not found')) return 'Website not found';
  if (text.includes('revision not found')) return 'Revision not found';
  if (text.includes('draft changed during edit')) return 'Draft changed during edit';
  if (text.includes('page limit exceeded')) return 'Page limit exceeded';
  if (text.includes('unfinished content blocks publish')) return 'Remove unfinished items before publishing.';
  if (text.includes('revision not publishable')) return 'Revision is not publishable.';
  if (text.includes('no published site to roll back')) return 'No published site to roll back.';
  if (text.includes('revision not rollback target')) return 'Revision cannot be restored.';
  if (text.includes('invalid draft save') || text.includes('invalid publish') || text.includes('invalid rollback')) return 'Invalid request';
  return '';
}

export function createWebsitePublishing({ url, serviceKey, fetchImpl = fetch }) {
  const origin = originOf(url);
  if (typeof serviceKey !== 'string' || serviceKey.length < 20) throw Error('Supabase service key required');
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
    if (!user || !UUID.test(user.id ?? '')) throw Error('Unauthorized');
    return { id: user.id, email: String(user.email || '').toLowerCase() };
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

  async function assertMember(userId, organizationId) {
    const membership = await rest(`/rest/v1/organization_members?organization_id=eq.${organizationId}&user_id=eq.${userId}&status=eq.active&select=role`);
    if (!Array.isArray(membership) || !membership[0]) throw Error('Unauthorized');
  }

  async function entitlements(organizationId) {
    const rows = await rest(`/rest/v1/organization_entitlements?organization_id=eq.${organizationId}&select=website_enabled,max_pages`);
    const ent = Array.isArray(rows) ? rows[0] : null;
    if (!ent?.website_enabled) throw Error('Website publishing is not included in this package.');
    return ent;
  }

  return {
    async listRevisions(jwt, organizationId) {
      const user = await identity(jwt);
      if (!UUID.test(organizationId ?? '')) throw Error('Invalid request');
      await assertMember(user.id, organizationId);
      await entitlements(organizationId);
      const sites = await rest(`/rest/v1/websites?organization_id=eq.${organizationId}&select=id,slug,status,draft_revision_id,published_revision_id`);
      const site = Array.isArray(sites) ? sites[0] : null;
      if (!site) throw Error('Website not found');
      const revisions = await rest(`/rest/v1/website_revisions?organization_id=eq.${organizationId}&select=id,revision_number,state,page_count,created_at,content&order=revision_number.desc&limit=30`);
      return {
        organizationId,
        website: {
          id: site.id,
          slug: site.slug,
          status: site.status,
          draftRevisionId: site.draft_revision_id,
          publishedRevisionId: site.published_revision_id,
          publicPath: site.status === 'published' ? `/site/${site.slug}` : null,
        },
        revisions: Array.isArray(revisions) ? revisions.map(row => ({
          id: row.id,
          revisionNumber: row.revision_number,
          state: row.state,
          pageCount: row.page_count,
          createdAt: row.created_at,
          unfinished: Array.isArray(row.content?.unfinished) ? row.content.unfinished : [],
        })) : [],
      };
    },

    async saveDraft(jwt, organizationId, input = {}) {
      const user = await identity(jwt);
      if (!UUID.test(organizationId ?? '') || !UUID.test(input.baseRevisionId ?? '')) throw Error('Invalid request');
      const ent = await entitlements(organizationId);
      const content = validateWebsiteContent(input.content, { maxPages: ent.max_pages });
      // Strip unfinished labels that are only fixture banners when owner explicitly clears them.
      if (input.clearUnfinished) content.unfinished = [];
      const result = await rpc('website_save_draft', {
        p_organization_id: organizationId,
        p_user_id: user.id,
        p_base_revision_id: input.baseRevisionId,
        p_content: content,
        p_page_count: content.pages.length,
      });
      return {
        websiteId: result.website_id,
        revisionId: result.revision_id,
        revisionNumber: result.revision_number,
        status: result.status,
        publishedRevisionId: result.published_revision_id,
        content,
      };
    },

    async publish(jwt, organizationId, revisionId) {
      const user = await identity(jwt);
      if (!UUID.test(organizationId ?? '') || !UUID.test(revisionId ?? '')) throw Error('Invalid request');
      await entitlements(organizationId);
      const result = await rpc('website_publish', {
        p_organization_id: organizationId,
        p_user_id: user.id,
        p_revision_id: revisionId,
      });
      return {
        websiteId: result.website_id,
        slug: result.slug,
        status: result.status,
        publishedRevisionId: result.published_revision_id,
        previousPublishedRevisionId: result.previous_published_revision_id,
        publicPath: result.public_path,
      };
    },

    async rollback(jwt, organizationId, revisionId) {
      const user = await identity(jwt);
      if (!UUID.test(organizationId ?? '') || !UUID.test(revisionId ?? '')) throw Error('Invalid request');
      await entitlements(organizationId);
      const result = await rpc('website_rollback', {
        p_organization_id: organizationId,
        p_user_id: user.id,
        p_revision_id: revisionId,
      });
      return {
        websiteId: result.website_id,
        slug: result.slug,
        status: result.status,
        publishedRevisionId: result.published_revision_id,
        previousPublishedRevisionId: result.previous_published_revision_id,
        duplicate: result.duplicate === true,
        publicPath: result.public_path,
      };
    },

    async previewDraft(jwt, organizationId) {
      const user = await identity(jwt);
      if (!UUID.test(organizationId ?? '')) throw Error('Invalid request');
      await assertMember(user.id, organizationId);
      await entitlements(organizationId);
      const sites = await rest(`/rest/v1/websites?organization_id=eq.${organizationId}&select=id,slug,status,draft_revision_id,published_revision_id`);
      const site = Array.isArray(sites) ? sites[0] : null;
      if (!site?.draft_revision_id) throw Error('Website not found');
      const revisions = await rest(`/rest/v1/website_revisions?id=eq.${site.draft_revision_id}&select=id,revision_number,content,page_count,state`);
      const draft = Array.isArray(revisions) ? revisions[0] : null;
      if (!draft) throw Error('Website not found');
      return {
        private: true,
        slug: site.slug,
        status: site.status,
        revisionId: draft.id,
        revisionNumber: draft.revision_number,
        content: draft.content,
        pageCount: draft.page_count,
      };
    },
  };
}
