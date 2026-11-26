import { supabase } from './supabase';

export type PublicWebsitePage = {
  slug: string;
  organization_name: string;
  revision_id: string;
  revision_number: number;
  schema_version: number;
  content: unknown;
  page_count: number;
  published: boolean;
};

export async function loadPublicWebsite(slug: string) {
  const value = typeof slug === 'string' ? slug.trim().toLowerCase() : '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length < 3 || value.length > 63) {
    return null;
  }
  const { data, error } = await supabase.rpc('website_public_page', { p_slug: value });
  if (error) throw error;
  if (!data || typeof data !== 'object') return null;
  return data as PublicWebsitePage;
}

export function publicWebsiteError(reason: unknown, fallback: string) {
  return reason instanceof Error && reason.message ? reason.message : fallback;
}
