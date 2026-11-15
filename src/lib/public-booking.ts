import { supabase } from './supabase';

export type PublicService = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
};

export type PublicBookingPage = {
  slug: string;
  business_name: string;
  phone: string | null;
  email: string | null;
  location: string | null;
  brand_primary: string | null;
  brand_accent: string | null;
  policies: string | null;
  booking_intro: string | null;
  timezone: string;
  services: PublicService[];
};

export type BookingSlot = {
  starts_at: string;
  ends_at: string;
};

export type BookingReceipt = {
  appointment_id: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  service_name: string;
  business_name: string;
  duplicate: boolean;
};

export type WorkspaceAppointment = {
  id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: 'confirmed' | 'cancelled';
  service_name: string;
};

type AppointmentRow = Omit<WorkspaceAppointment, 'service_name'> & {
  services: { name: string } | { name: string }[] | null;
};

function messageOf(error: unknown) {
  const details = error && typeof error === 'object' ? error as { message?: string; code?: string } : {};
  return { message: details.message ?? '', code: details.code ?? '' };
}

export function guestBookingError(error: unknown, fallback: string) {
  const { message, code } = messageOf(error);
  if (message.includes('appointment conflict') || message.includes('slot is not open')) return 'That time was just taken. Choose another time.';
  if (message.includes('idempotency conflict')) return 'This submission does not match the earlier attempt. Refresh the page and choose the time again.';
  if (message.includes('invalid booking')) return 'Enter a name, a valid email, and a phone number.';
  if (message.includes('booking is not available')) return 'This booking page is not available.';
  if (code === 'PGRST202' || code === 'PGRST205' || code === '42883' || message.includes('schema cache') || message.includes('does not exist')) {
    return 'Online booking is not available until its database migration is applied.';
  }
  return fallback;
}

export function appointmentError(error: unknown, fallback: string) {
  const { message, code } = messageOf(error);
  if (message.includes('appointment cannot change')) return 'This appointment can only be cancelled.';
  if (message.includes('booking is not available')) return 'This appointment is not in the selected workspace.';
  if (code === 'PGRST205' || code === '42P01' || code === '42703' || message.includes('schema cache') || message.includes('does not exist')) {
    return 'Appointments are not available until the booking migration is applied.';
  }
  return fallback;
}

export function formatBookingTime(value: string, timeZone: string, options?: Intl.DateTimeFormatOptions) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone, ...options }).format(date);
  } catch {
    return 'Time unavailable';
  }
}

export function groupSlots(slots: BookingSlot[], timeZone: string) {
  const groups = new Map<string, BookingSlot[]>();
  for (const slot of slots) {
    const label = formatBookingTime(slot.starts_at, timeZone, { weekday: 'long', month: 'long', day: 'numeric' });
    const current = groups.get(label) ?? [];
    current.push(slot);
    groups.set(label, current);
  }
  return [...groups.entries()];
}

function jsonObject<T>(value: unknown): T | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as T;
}

export async function getBookingPublication(organizationId: string) {
  const { data, error } = await supabase
    .from('organization_settings')
    .select('booking_published')
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) throw error;
  return data?.booking_published === true;
}

export async function setBookingPublished(organizationId: string, published: boolean) {
  const { data, error } = await supabase
    .from('organization_settings')
    .update({ booking_published: published })
    .eq('organization_id', organizationId)
    .select('booking_published');
  if (error) throw error;
  if (!data?.length) throw Error('booking is not available');
  return data[0].booking_published === true;
}

export async function loadPublicBookingPage(slug: string) {
  const { data, error } = await supabase.rpc('booking_public_page', { p_slug: slug });
  if (error) throw error;
  const page = jsonObject<PublicBookingPage>(data);
  if (!page?.business_name || !Array.isArray(page.services)) return null;
  return page;
}

export async function loadOpenSlots(slug: string, serviceId: string) {
  const { data, error } = await supabase.rpc('booking_open_slots', { p_slug: slug, p_service_id: serviceId });
  if (error) throw error;
  if (!Array.isArray(data)) return [];
  return data.filter((slot): slot is BookingSlot => Boolean(slot) && typeof slot.starts_at === 'string' && typeof slot.ends_at === 'string');
}

export async function createGuestBooking(input: {
  slug: string;
  serviceId: string;
  startsAt: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  idempotencyKey: string;
}) {
  const { data, error } = await supabase.rpc('booking_create_appointment', {
    p_slug: input.slug,
    p_service_id: input.serviceId,
    p_starts_at: input.startsAt,
    p_guest_name: input.guestName,
    p_guest_email: input.guestEmail,
    p_guest_phone: input.guestPhone,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw error;
  const receipt = jsonObject<BookingReceipt>(data);
  if (!receipt?.appointment_id) throw Error('booking is not available');
  return receipt;
}

export function submissionKey(parts: string) {
  const storageKey = `booking-submit:${parts}`;
  try {
    const existing = sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const created = crypto.randomUUID();
    sessionStorage.setItem(storageKey, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

function serviceName(value: AppointmentRow['services']) {
  if (!value) return 'Service';
  if (Array.isArray(value)) return value[0]?.name || 'Service';
  return value.name || 'Service';
}

export async function listAppointments(organizationId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('appointments')
    .select('id, guest_name, guest_email, guest_phone, starts_at, ends_at, timezone, status, services!appointments_service_fk(name)')
    .eq('organization_id', organizationId)
    .gte('starts_at', since)
    .order('starts_at', { ascending: true })
    .limit(100);
  if (error) throw error;
  return ((data ?? []) as AppointmentRow[]).map(row => ({
    id: row.id,
    guest_name: row.guest_name,
    guest_email: row.guest_email,
    guest_phone: row.guest_phone,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    timezone: row.timezone,
    status: row.status,
    service_name: serviceName(row.services),
  }));
}

export async function cancelAppointment(organizationId: string, appointmentId: string) {
  const { data, error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('organization_id', organizationId)
    .eq('id', appointmentId)
    .eq('status', 'confirmed')
    .select('id');
  if (error) throw error;
  if (!data?.length) throw Error('booking is not available');
}
