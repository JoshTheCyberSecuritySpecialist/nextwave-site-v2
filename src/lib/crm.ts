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
