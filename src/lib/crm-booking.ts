import { supabase } from './supabase';

export const bookingTimezones = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC',
] as const;

export const weekdays = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const;

export type BookingSettings = {
  business_name: string;
  phone: string | null;
  email: string | null;
  location: string | null;
  brand_primary: string | null;
  brand_accent: string | null;
  policies: string | null;
  booking_intro: string | null;
  timezone: string;
  hours: unknown;
};

export type ProfileInput = {
  businessName: string;
  phone: string;
  email: string;
  location: string;
  brandPrimary: string;
  brandAccent: string;
  bookingIntro: string;
  policies: string;
  timezone: string;
};

export type BookingService = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  active: boolean;
  updated_at: string;
};

export type ServiceInput = {
  name: string;
  description: string;
  durationMinutes: number;
  active: boolean;
};

export type WeeklyWindow = {
  weekday: number;
  start_minute: number;
  end_minute: number;
};

export type DayInput = {
  weekday: number;
  closed: boolean;
  start: string;
  end: string;
};

const settingsColumns = 'business_name, phone, email, location, brand_primary, brand_accent, policies, booking_intro, timezone, hours';

export function bookingError(error: unknown, fallback: string) {
  if (error instanceof Error && /needs an opening|closing time after the opening/.test(error.message)) return error.message;
  const details = error && typeof error === 'object' ? error as { message?: string; code?: string } : {};
  const message = details.message ?? '';
  const code = details.code ?? '';
  if (message.includes('service cap exceeded')) return 'This workspace has reached its service limit.';
  if (message.includes('calendar cap exceeded')) return 'This workspace already has its one staff calendar.';
  if (message.includes('calendar is not in this organization') || message.includes('organization cannot change')) return 'That schedule is not in this workspace.';
  if (message.includes('booking setup is not available')) return 'Booking setup is not available for this workspace.';
  if (message.includes('messages are not included')) return 'Reminder text is not included in this package.';
  if (message.includes('hours are too large') || message.includes('hours must be a weekly schedule')) return 'Weekly hours could not be saved in that form.';
  if (message.includes('publish requires a service')) return 'Add a service before publishing the booking page.';
  if (message.includes('publish requires weekly hours')) return 'Add weekly hours before publishing the booking page.';
  if (message.includes('duration_minutes')) return 'Duration must be between 5 minutes and 8 hours.';
  if (code === '23505' && message.includes('calendars')) return 'This workspace already has its one staff calendar.';
  if (code === '23505' && message.includes('weekly_hours')) return 'Each day can have one range of hours.';
  if (code === 'PGRST205' || code === '42P01' || message.includes('schema cache') || message.includes('does not exist')) {
    return 'Booking setup is not available until its database migration is applied.';
  }
  if (code === '42501' || message.includes('permission denied')) {
    return 'Booking settings cannot be saved until the booking setup migration is applied.';
  }
  return fallback;
}

export function timeToMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function formatClock(minutes: number) {
  const date = new Date(Date.UTC(2000, 0, 1, Math.floor(minutes / 60), minutes % 60));
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(date);
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return hours === 1 ? '1 hour' : `${hours} hours`;
  return `${hours} hour${hours === 1 ? '' : 's'} ${rest} minutes`;
}

export function weekdayLabel(weekday: number) {
  return weekdays.find(day => day.value === weekday)?.label ?? 'Day';
}

export function emptyWeek(): DayInput[] {
  return weekdays.map(day => ({ weekday: day.value, closed: true, start: '', end: '' }));
}

export function parseOpenDays(days: DayInput[]) {
  const open: WeeklyWindow[] = [];
  for (const day of days) {
    if (day.closed) continue;
    const label = weekdayLabel(day.weekday);
    const start = timeToMinutes(day.start);
    const end = timeToMinutes(day.end);
    if (start == null || end == null) throw Error(`${label} needs an opening and a closing time.`);
    if (end <= start) throw Error(`${label} needs a closing time after the opening time.`);
    open.push({ weekday: day.weekday, start_minute: start, end_minute: end });
  }
  return open;
}

function blank(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function getBookingSettings(organizationId: string) {
  const { data, error } = await supabase
    .from('organization_settings')
    .select(settingsColumns)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) throw error;
  return data as BookingSettings | null;
}

export async function updateBookingSettings(organizationId: string, input: ProfileInput) {
  const { data, error } = await supabase
    .from('organization_settings')
    .update({
      business_name: input.businessName.trim(),
      phone: blank(input.phone),
      email: blank(input.email)?.toLowerCase() ?? null,
      location: blank(input.location),
      brand_primary: blank(input.brandPrimary),
      brand_accent: blank(input.brandAccent),
      booking_intro: blank(input.bookingIntro),
      policies: blank(input.policies),
      timezone: input.timezone.trim(),
    })
    .eq('organization_id', organizationId)
    .select('organization_id');
  if (error) throw error;
  if (!data?.length) throw Error('booking setup is not available');
}

export async function listServices(organizationId: string) {
  const { data, error } = await supabase
    .from('services')
    .select('id, name, description, duration_minutes, active, updated_at')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as BookingService[];
}

export async function getService(organizationId: string, serviceId: string) {
  const { data, error } = await supabase
    .from('services')
    .select('id, name, description, duration_minutes, active, updated_at')
    .eq('organization_id', organizationId)
    .eq('id', serviceId)
    .maybeSingle();
  if (error) throw error;
  return data as BookingService | null;
}

export async function createService(organizationId: string, input: ServiceInput) {
  const { data, error } = await supabase
    .from('services')
    .insert({
      organization_id: organizationId,
      name: input.name.trim(),
      description: blank(input.description),
      duration_minutes: input.durationMinutes,
      active: input.active,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateService(organizationId: string, serviceId: string, input: ServiceInput) {
  const { data, error } = await supabase
    .from('services')
    .update({
      name: input.name.trim(),
      description: blank(input.description),
      duration_minutes: input.durationMinutes,
      active: input.active,
    })
    .eq('organization_id', organizationId)
    .eq('id', serviceId)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw Error('booking setup is not available');
}

export async function deleteService(organizationId: string, serviceId: string) {
  const { data, error } = await supabase
    .from('services')
    .delete()
    .eq('organization_id', organizationId)
    .eq('id', serviceId)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw Error('booking setup is not available');
}

export async function listWeeklyHours(organizationId: string) {
  const calendar = await supabase.from('calendars').select('id').eq('organization_id', organizationId).maybeSingle();
  if (calendar.error) throw calendar.error;
  if (!calendar.data) return { calendarId: null as string | null, windows: [] as WeeklyWindow[] };
  const hours = await supabase
    .from('weekly_hours')
    .select('weekday, start_minute, end_minute')
    .eq('organization_id', organizationId)
    .eq('calendar_id', calendar.data.id)
    .order('weekday', { ascending: true });
  if (hours.error) throw hours.error;
  return { calendarId: calendar.data.id as string, windows: (hours.data ?? []) as WeeklyWindow[] };
}

export async function saveWeeklyHours(organizationId: string, days: DayInput[]) {
  const open = parseOpenDays(days);
  const { error } = await supabase.rpc('crm_replace_weekly_hours', {
    p_organization_id: organizationId,
    p_windows: open,
  });
  if (error) throw error;
}
