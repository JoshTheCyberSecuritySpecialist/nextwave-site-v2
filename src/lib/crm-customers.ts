import { supabase } from './supabase';

export const pageSize = 20;

export type CustomerStatus = 'active' | 'archived';
export type LeadStage = 'inquiry' | 'booked' | 'completed';

export type CustomerSummary = {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  status: CustomerStatus;
  lead_stage: LeadStage;
  tags: string[];
  updated_at: string;
};

export type CustomerNote = {
  id: string;
  body: string;
  created_at: string;
};

export type CustomerActivity = {
  id: string;
  kind: 'created' | 'updated' | 'note';
  summary: string;
  created_at: string;
};

export type CustomerInput = {
  displayName: string;
  email: string;
  phone: string;
  status: CustomerStatus;
  leadStage: LeadStage;
  tags: string;
};

export function customerError(error: unknown, fallback: string) {
  const details = error && typeof error === 'object' ? error as { message?: string; code?: string } : {};
  const message = details.message ?? '';
  const code = details.code ?? '';
  if (code === '23505' || message.includes('customers_org_email')) return 'A customer with this email is already in this workspace.';
  if (message.includes('customer is not in this organization')) return 'That customer is not in this workspace.';
  if (message.includes('customer directory is not included')) return 'This package does not include the customer directory.';
  if (message.includes('customer cap exceeded')) return 'This workspace has reached its customer record limit.';
  if (message.includes('too many tags') || message.includes('invalid tag')) return 'Use up to 20 tags. Each tag can contain letters, numbers, spaces, and hyphens.';
  if (code === 'PGRST205' || code === '42P01' || message.includes('schema cache') || message.includes('does not exist')) {
    return 'The customer directory is not available until its database migration is applied.';
  }
  return fallback;
}

function cleanSearch(value: string) {
  return value.trim().replace(/[%_,.()]/g, '').slice(0, 80);
}

export function parseTags(value: string) {
  return [...new Set(value.split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean))];
}

export async function customerCounts(organizationId: string) {
  const active = await supabase.from('customers').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('status', 'active');
  if (active.error) throw active.error;
  const archived = await supabase.from('customers').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('status', 'archived');
  if (archived.error) throw archived.error;
  return { active: active.count ?? 0, archived: archived.count ?? 0 };
}

export async function recentActivity(organizationId: string) {
  const { data, error } = await supabase
    .from('customer_activities')
    .select('id, kind, summary, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(8);
  if (error) throw error;
  return (data ?? []) as CustomerActivity[];
}

export async function listCustomers(organizationId: string, filters: { search: string; status: string; stage: string; page: number }) {
  const from = Math.max(0, filters.page) * pageSize;
  let query = supabase
    .from('customers')
    .select('id, display_name, email, phone, status, lead_stage, tags, updated_at', { count: 'exact' })
    .eq('organization_id', organizationId)
    .order('display_name', { ascending: true })
    .range(from, from + pageSize - 1);
  if (filters.status === 'active' || filters.status === 'archived') query = query.eq('status', filters.status);
  if (filters.stage === 'inquiry' || filters.stage === 'booked' || filters.stage === 'completed') query = query.eq('lead_stage', filters.stage);
  const search = cleanSearch(filters.search);
  if (search) query = query.or(`display_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
  const { data, error, count } = await query;
  if (error) throw error;
  return { customers: (data ?? []) as CustomerSummary[], count: count ?? 0 };
}

export async function getCustomer(organizationId: string, customerId: string) {
  const { data, error } = await supabase
    .from('customers')
    .select('id, display_name, email, phone, status, lead_stage, tags, updated_at, created_at')
    .eq('organization_id', organizationId)
    .eq('id', customerId)
    .maybeSingle();
  if (error) throw error;
  return data as (CustomerSummary & { created_at: string }) | null;
}

export async function listNotes(organizationId: string, customerId: string) {
  const { data, error } = await supabase
    .from('customer_notes')
    .select('id, body, created_at')
    .eq('organization_id', organizationId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CustomerNote[];
}

export async function listCustomerActivity(organizationId: string, customerId: string) {
  const { data, error } = await supabase
    .from('customer_activities')
    .select('id, kind, summary, created_at')
    .eq('organization_id', organizationId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CustomerActivity[];
}

export type CustomerAppointment = {
  id: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: string;
  guest_name: string;
  service_name: string;
};

export async function listCustomerAppointments(organizationId: string, customerId: string) {
  const { data, error } = await supabase
    .from('appointments')
    .select('id, guest_name, starts_at, ends_at, timezone, status, services!appointments_service_fk(name)')
    .eq('organization_id', organizationId)
    .eq('customer_id', customerId)
    .order('starts_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return ((data ?? []) as Array<{
    id: string;
    guest_name: string;
    starts_at: string;
    ends_at: string;
    timezone: string;
    status: string;
    services: { name: string } | Array<{ name: string }> | null;
  }>).map(row => ({
    id: row.id,
    guest_name: row.guest_name,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    timezone: row.timezone,
    status: row.status,
    service_name: Array.isArray(row.services) ? (row.services[0]?.name || 'Service') : (row.services?.name || 'Service'),
  }));
}

function payload(organizationId: string, input: CustomerInput) {
  return {
    organization_id: organizationId,
    display_name: input.displayName.trim(),
    email: input.email.trim().toLowerCase() || null,
    phone: input.phone.trim() || null,
    status: input.status,
    lead_stage: input.leadStage,
    tags: parseTags(input.tags),
  };
}

export async function createCustomer(organizationId: string, input: CustomerInput) {
  const { data, error } = await supabase.from('customers').insert(payload(organizationId, input)).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function updateCustomer(organizationId: string, customerId: string, input: CustomerInput) {
  const next = payload(organizationId, input);
  const { error } = await supabase.from('customers').update({
    display_name: next.display_name,
    email: next.email,
    phone: next.phone,
    status: next.status,
    lead_stage: next.lead_stage,
    tags: next.tags,
  }).eq('organization_id', organizationId).eq('id', customerId);
  if (error) throw error;
}

export async function addNote(organizationId: string, customerId: string, body: string) {
  const { error } = await supabase.from('customer_notes').insert({ organization_id: organizationId, customer_id: customerId, body: body.trim() });
  if (error) throw error;
}
