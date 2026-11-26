import { supabase } from './supabase';

export type PublicWebsitePage = {
  slug: string;
  organization_name: string;
  organization_slug?: string;
  revision_id: string;
  revision_number: number;
  schema_version: number;
  content: unknown;
  page_count: number;
  published: boolean;
  booking_enabled?: boolean;
  booking_path?: string | null;
  contact_enabled?: boolean;
};

export type WebsiteInquiryInput = {
  name: string;
  email: string;
  phone: string;
  body: string;
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

export async function submitWebsiteInquiry(slug: string, input: WebsiteInquiryInput) {
  const value = typeof slug === 'string' ? slug.trim().toLowerCase() : '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length < 3 || value.length > 63) {
    throw Error('This website could not accept the message.');
  }
  const { data, error } = await supabase.rpc('website_submit_inquiry', {
    p_slug: value,
    p_name: input.name.trim(),
    p_email: input.email.trim().toLowerCase(),
    p_phone: input.phone.trim() || null,
    p_body: input.body.trim(),
  });
  if (error) {
    const message = error.message || '';
    if (/invalid inquiry/i.test(message)) throw Error('Check the form fields and try again.');
    if (/website not found/i.test(message)) throw Error('This website is not accepting messages.');
    throw Error('Message could not be sent.');
  }
  return data as { id: string; created: boolean };
}

export function publicWebsiteError(reason: unknown, fallback: string) {
  return reason instanceof Error && reason.message ? reason.message : fallback;
}
