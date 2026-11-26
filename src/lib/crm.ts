import { apiUrl } from './payments-client.mjs';
import { supabase } from './supabase';

const apiEnv = { dev: import.meta.env.DEV, configured: import.meta.env.VITE_API_BASE_URL };

export type Workspace = {
  role: 'owner' | 'member';
  organizationId: string;
  name: string;
  slug: string;
  packageId: string;
  status: string;
};

export type CrmSelection = Workspace & {
  crmEnabled: boolean;
  websiteEnabled: boolean;
  maxCustomers: number;
  maxServices: number | null;
  maxPages: number;
};

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  package_id: string;
  status: string;
};

type MemberRow = {
  role: string;
  status: string;
  organizations: OrganizationRow | OrganizationRow[] | null;
};

function oneOrganization(value: OrganizationRow | OrganizationRow[] | null) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function loadWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('role, status, organizations(id, name, slug, package_id, status)')
    .eq('status', 'active');
  if (error) throw error;
  return ((data ?? []) as MemberRow[]).flatMap(row => {
    const organization = oneOrganization(row.organizations);
    if (!organization || (row.role !== 'owner' && row.role !== 'member')) return [];
    return [{
      role: row.role,
      organizationId: organization.id,
      name: organization.name,
      slug: organization.slug,
      packageId: organization.package_id,
      status: organization.status,
    }];
  });
}

export async function loadEntitlements(organizationIds: string[]) {
  if (organizationIds.length === 0) return [];
  const { data, error } = await supabase
    .from('organization_entitlements')
    .select('organization_id, crm_enabled, website_enabled, max_customers, max_services, max_pages')
    .in('organization_id', organizationIds);
  if (error) throw error;
  return (data ?? []) as {
    organization_id: string;
    crm_enabled: boolean;
    website_enabled: boolean;
    max_customers: number;
    max_services: number | null;
    max_pages: number;
  }[];
}

export async function previewInvitation(token: string) {
  let response: Response;
  try {
    response = await fetch(apiUrl('/api/crm/invitations/preview', apiEnv), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token.trim().toLowerCase() }),
    });
  } catch {
    throw Error('The invitation could not be loaded.');
  }
  const body = await response.json().catch(() => null) as { error?: string; email?: string; organizationName?: string } | null;
  if (!response.ok || !body?.email) throw Error(body?.error || 'The invitation could not be loaded.');
  return body;
}

export async function setupInvitedAccount(token: string, password: string) {
  let response: Response;
  try {
    response = await fetch(apiUrl('/api/crm/invitations/setup', apiEnv), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token.trim().toLowerCase(), password }),
    });
  } catch {
    throw Error('Account setup failed.');
  }
  const body = await response.json().catch(() => null) as { error?: string; email?: string; created?: boolean } | null;
  if (!response.ok || !body?.email) throw Error(body?.error || 'Account setup failed.');
  return body;
}

export async function acceptInvitation(accessToken: string, token: string) {
  let response: Response;
  try {
    response = await fetch(apiUrl('/api/crm/invitations/accept', apiEnv), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ token: token.trim().toLowerCase() }),
    });
  } catch {
    throw Error('The invitation could not be accepted.');
  }
  const body = await response.json().catch(() => null) as { error?: string; organizationId?: string } | null;
  if (!response.ok || !body?.organizationId) throw Error(body?.error || 'The invitation could not be accepted.');
  return body;
}
