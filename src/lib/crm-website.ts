import { apiUrl } from './payments-client.mjs';
import { supabase } from './supabase';

const apiEnv = { dev: import.meta.env.DEV, configured: import.meta.env.VITE_API_BASE_URL };

export type WebsiteIntakeInput = {
  publicName: string;
  industry: string;
  description: string;
  publicEmail: string;
  publicPhone: string;
  locationText: string;
  serviceArea: string;
  timezone: string;
  brandPrimary: string;
  brandSecondary: string;
  typographyPreference: string;
  styleDirection: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  privateNotes: string;
};

export type WebsiteStatus = {
  organizationId: string;
  websiteEnabled: boolean;
  maxPages: number;
  maxGenerationRuns: number;
  usedGenerationRuns: number;
  intakeComplete: boolean;
  profileName: string | null;
  website: { id: string; slug: string; status: string; draftRevisionId: string | null; publishedRevisionId: string | null } | null;
  draftRevision: {
    id: string;
    revisionNumber: number;
    schemaVersion: number;
    pageCount: number;
    content: unknown;
    createdAt: string;
  } | null;
  jobs: Array<{
    id: string;
    status: string;
    progress: number;
    errorMessage: string | null;
    provider: string | null;
    resultRevisionId: string | null;
    createdAt: string;
    finishedAt: string | null;
  }>;
};

export function websiteError(reason: unknown, fallback: string) {
  return reason instanceof Error && reason.message ? reason.message : fallback;
}

export async function loadBusinessProfile(organizationId: string) {
  const { data, error } = await supabase
    .from('business_profiles')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveBusinessProfile(organizationId: string, input: WebsiteIntakeInput, { complete = false } = {}) {
  const payload = {
    organization_id: organizationId,
    public_name: input.publicName.trim(),
    industry: input.industry.trim() || null,
    description: input.description.trim() || null,
    public_email: input.publicEmail.trim().toLowerCase() || null,
    public_phone: input.publicPhone.trim() || null,
    location_text: input.locationText.trim() || null,
    service_area: input.serviceArea.trim() || null,
    timezone: input.timezone.trim() || 'America/New_York',
    brand_primary: input.brandPrimary.trim() || null,
    brand_secondary: input.brandSecondary.trim() || null,
    typography_preference: input.typographyPreference.trim() || null,
    style_direction: input.styleDirection.trim() || null,
    primary_cta_label: input.primaryCtaLabel.trim() || null,
    primary_cta_href: input.primaryCtaHref.trim() || null,
    private_notes: input.privateNotes.trim() || null,
    intake_complete: complete,
    updated_at: new Date().toISOString(),
  };
  if (!payload.public_name) throw Error('Business name is required.');
  if (complete) {
    if (!payload.industry) throw Error('Industry is required before generation.');
    if (!payload.description || payload.description.length < 40) throw Error('Add a public description of at least 40 characters.');
    if (!payload.public_email && !payload.public_phone) throw Error('Add a public email or phone number.');
  }
  const { data, error } = await supabase
    .from('business_profiles')
    .upsert(payload, { onConflict: 'organization_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function authorizedFetch(path: string, accessToken: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(apiUrl(path, apiEnv), {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw Error('Website services are unavailable.');
  }
  const body = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw Error(body?.error || 'Website services are unavailable.');
  return body;
}

export async function loadWebsiteStatus(accessToken: string, organizationId: string) {
  return authorizedFetch(`/api/crm/organizations/${organizationId}/website`, accessToken) as Promise<WebsiteStatus>;
}

export async function generateWebsite(accessToken: string, organizationId: string, idempotencyKey: string) {
  return authorizedFetch(`/api/crm/organizations/${organizationId}/website/generate`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ idempotencyKey, scope: 'full_site' }),
  }) as Promise<{
    jobId: string;
    status: string;
    duplicate?: boolean;
    revisionId?: string;
    fixture?: boolean;
    provider?: string;
    content?: unknown;
  }>;
}

export function missingIntakeFields(input: WebsiteIntakeInput) {
  const missing: string[] = [];
  if (!input.publicName.trim()) missing.push('Business name');
  if (!input.industry.trim()) missing.push('Industry');
  if (input.description.trim().length < 40) missing.push('Public description');
  if (!input.publicEmail.trim() && !input.publicPhone.trim()) missing.push('Public email or phone');
  return missing;
}
