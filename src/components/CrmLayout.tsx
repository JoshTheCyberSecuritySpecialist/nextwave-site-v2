import { FormEvent, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { acceptInvitation, loadEntitlements, loadWorkspaces, type CrmSelection } from '../lib/crm';

const storageKey = 'crm-organization-id';

export default function CrmLayout() {
  const navigate = useNavigate();
  const { session, user, signOut } = useAuth();
  const [workspaces, setWorkspaces] = useState<CrmSelection[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const selected = workspaces.find(workspace => workspace.organizationId === organizationId) ?? null;

  useEffect(() => {
    let stopped = false;
    setLoading(true);
    setError('');
    loadWorkspaces()
      .then(async rows => {
        const entitlements = await loadEntitlements(rows.map(row => row.organizationId));
        const byId = new Map(entitlements.map(item => [item.organization_id, item]));
        const next = rows.map(row => ({
          ...row,
          crmEnabled: byId.get(row.organizationId)?.crm_enabled === true,
          websiteEnabled: byId.get(row.organizationId)?.website_enabled === true,
          maxCustomers: byId.get(row.organizationId)?.max_customers ?? 0,
          maxServices: byId.get(row.organizationId)?.max_services ?? null,
          maxPages: byId.get(row.organizationId)?.max_pages ?? 0,
          maxGenerationRuns: byId.get(row.organizationId)?.max_generation_runs ?? 0,
        }));
        if (stopped) return;
        setWorkspaces(next);
        const stored = sessionStorage.getItem(storageKey);
        const match = next.find(item => item.organizationId === stored) ?? next[0];
        setOrganizationId(match?.organizationId ?? '');
      })
      .catch(() => { if (!stopped) setError('Your workspace could not be loaded.'); })
      .finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; };
  }, [session?.access_token, notice]);

  function chooseOrganization(nextId: string) {
    setOrganizationId(nextId);
    sessionStorage.setItem(storageKey, nextId);
    setMenuOpen(false);
  }

  async function onAccept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.access_token) return;
    const token = String(new FormData(event.currentTarget).get('token') ?? '');
    setAccepting(true);
    setError('');
    try {
      await acceptInvitation(session.access_token, token);
      setNotice('Invitation accepted.');
      event.currentTarget.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The invitation could not be accepted.');
    } finally {
      setAccepting(false);
    }
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-[#2283B8] text-white' : 'text-gray-300 hover:bg-[#0A0F1E]'}`;

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white">
      <header className="flex h-16 items-center justify-between gap-3 border-b border-gray-800 bg-[#0d1424] px-4">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" className="rounded-lg border border-gray-700 px-3 py-2 text-sm lg:hidden" aria-expanded={menuOpen} aria-controls="crm-sidebar" onClick={() => setMenuOpen(open => !open)}>Menu</button>
          <img src="/nextwave_smoothblue.png" alt="NextWave" className="h-8" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{selected?.name ?? 'Workspace'}</p>
            <p className="truncate text-xs text-gray-400">{user?.email}</p>
          </div>
        </div>
        <button type="button" className="rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-[#0A0F1E]" onClick={() => { void signOut().then(() => navigate('/crm/login')); }}>Sign out</button>
      </header>
      <div className="lg:grid lg:grid-cols-[16rem_1fr]">
        <nav id="crm-sidebar" className={`${menuOpen ? 'block' : 'hidden'} border-b border-gray-800 bg-[#0d1424] p-4 lg:block lg:min-h-[calc(100vh-4rem)] lg:border-b-0 lg:border-r`}>
          {workspaces.length > 1 && (
            <label className="mb-4 block text-sm text-gray-300">
              Business
              <select className="mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-[#0A0F1E] px-3" value={organizationId} onChange={event => chooseOrganization(event.target.value)}>
                {workspaces.map(workspace => <option key={workspace.organizationId} value={workspace.organizationId}>{workspace.name}</option>)}
              </select>
            </label>
          )}
          <ul className="space-y-1">
            <li><NavLink to="/crm" end className={linkClass} onClick={() => setMenuOpen(false)}>Overview</NavLink></li>
            {selected && (
              <>
                <li><NavLink to="/crm/profile" className={linkClass} onClick={() => setMenuOpen(false)}>Profile</NavLink></li>
                {selected.websiteEnabled && (
                  <>
                    <li><NavLink to="/crm/website" className={linkClass} onClick={() => setMenuOpen(false)}>Website</NavLink></li>
                    <li><NavLink to="/crm/website/intake" className={linkClass} onClick={() => setMenuOpen(false)}>Website intake</NavLink></li>
                    <li><NavLink to="/crm/website/preview" className={linkClass} onClick={() => setMenuOpen(false)}>Website preview</NavLink></li>
                    <li><NavLink to="/crm/inquiries" className={linkClass} onClick={() => setMenuOpen(false)}>Inquiries</NavLink></li>
                  </>
                )}
                {(selected.crmEnabled || selected.packageId === 'booking-only') && (
                  <>
                    <li><NavLink to="/crm/services" className={linkClass} onClick={() => setMenuOpen(false)}>Services</NavLink></li>
                    <li><NavLink to="/crm/hours" className={linkClass} onClick={() => setMenuOpen(false)}>Hours</NavLink></li>
                    <li><NavLink to="/crm/booking" className={linkClass} onClick={() => setMenuOpen(false)}>Booking page</NavLink></li>
                    <li><NavLink to="/crm/appointments" className={linkClass} onClick={() => setMenuOpen(false)}>Appointments</NavLink></li>
                  </>
                )}
              </>
            )}
            {selected?.crmEnabled && <li><NavLink to="/crm/customers" className={linkClass} onClick={() => setMenuOpen(false)}>Customers</NavLink></li>}
          </ul>
        </nav>
        <main className="px-4 py-8 sm:px-6">
          {loading && <div className="grid gap-4 sm:grid-cols-2"><div className="h-28 animate-pulse rounded-xl bg-[#0d1424]" /><div className="h-28 animate-pulse rounded-xl bg-[#0d1424]" /></div>}
          {error && <p role="alert" className="text-red-200">{error}</p>}
          {notice && <p role="status" className="mb-4 text-[#7dd3f5]">{notice}</p>}
          {!loading && workspaces.length === 0 && (
            <section className="max-w-xl rounded-xl border border-gray-800 bg-[#0d1424] p-5">
              <h1 className="text-2xl font-bold">No workspace yet</h1>
              <p className="mt-2 text-gray-300">Enter the invitation code from Next Wave, or open the invite link at <span className="font-mono text-sm">/crm/invite</span> to create an account first.</p>
              <form className="mt-4 space-y-3" onSubmit={onAccept}>
                <label htmlFor="invitation-code" className="block text-sm text-gray-300">Invitation code</label>
                <input id="invitation-code" name="token" required autoComplete="off" spellCheck={false} pattern="[a-fA-F0-9]{64}" minLength={64} maxLength={64} className="min-h-11 w-full rounded-lg border border-gray-700 bg-[#0A0F1E] px-3 font-mono text-sm" />
                <button type="submit" disabled={accepting} className="min-h-11 rounded-lg bg-[#2283B8] px-4 font-semibold disabled:opacity-50">{accepting ? 'Checking…' : 'Accept invitation'}</button>
              </form>
            </section>
          )}
          {!loading && selected && <Outlet context={selected} />}
        </main>
      </div>
    </div>
  );
}
