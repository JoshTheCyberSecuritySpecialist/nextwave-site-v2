import { supabase } from './supabase';

export type WebsiteInquiry = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  body: string;
  created_at: string;
};

export function inquiryError(reason: unknown, fallback: string) {
  return reason instanceof Error && reason.message ? reason.message : fallback;
}

export async function listWebsiteInquiries(organizationId: string) {
  const { data, error } = await supabase
    .from('website_inquiries')
    .select('id, name, email, phone, body, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as WebsiteInquiry[];
}
