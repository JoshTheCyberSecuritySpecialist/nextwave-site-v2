import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { bookingPackage, websiteCrmPackage } from '../data/offers';
import { acceptInvitation, loadWorkspaces, type Workspace } from '../lib/crm';

function packageSummary(packageId: string) {
  if (packageId === websiteCrmPackage.id) return `${websiteCrmPackage.name}. ${websiteCrmPackage.limits}`;
  if (packageId === bookingPackage.id) return `${bookingPackage.name}. ${bookingPackage.scopeNote}`;
  return 'Workspace package';
}

export default function CrmWorkspace() {
  const navigate = useNavigate();
  const { session, user, signOut } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    let stopped = false;
    setLoading(true);
    setError('');
    loadWorkspaces()
      .then(rows => { if (!stopped) setWorkspaces(rows); })
      .catch(() => { if (!stopped) setError('Your workspace could not be loaded.'); })
      .finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; };
  }, [session?.access_token, notice]);

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

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white">
      <header className="flex h-16 items-center justify-between border-b border-gray-800 bg-[#0d1424] px-4">
        <div className="flex items-center gap-3">
          <img src="/nextwave_smoothblue.png" alt="NextWave" className="h-8" />
          <span className="font-semibold">Workspace</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-300">
          <span className="hidden sm:inline">{user?.email}</span>
          <button type="button" className="rounded-lg px-3 py-2 hover:bg-[#0A0F1E]" onClick={() => { void signOut().then(() => navigate('/crm/login')); }}>Sign out</button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-3xl font-bold">Your workspace</h1>
        <p className="mt-3 text-gray-300">You can see only the businesses this account belongs to. Customer records, booking, and messages are not open in this release.</p>
        {loading && <p className="mt-8 text-gray-300">Loading workspace…</p>}
        {error && <p role="alert" className="mt-8 text-red-200">{error}</p>}
        {notice && <p role="status" className="mt-8 text-[#7dd3f5]">{notice}</p>}
        {!loading && workspaces.length === 0 && (
          <section className="mt-8 rounded-xl border border-gray-800 bg-[#0d1424] p-5">
            <h2 className="text-xl font-semibold">No workspace yet</h2>
            <p className="mt-2 text-gray-300">Enter the invitation code from Next Wave. This page does not create a new account.</p>
            <form className="mt-4 space-y-3" onSubmit={onAccept}>
              <label htmlFor="invitation-code" className="block text-sm text-gray-300">Invitation code</label>
              <input id="invitation-code" name="token" required autoComplete="off" spellCheck={false} pattern="[a-fA-F0-9]{64}" minLength={64} maxLength={64} className="min-h-11 w-full rounded-lg border border-gray-700 bg-[#0A0F1E] px-3 font-mono text-sm" />
              <button type="submit" disabled={accepting} className="min-h-11 rounded-lg bg-[#2283B8] px-4 font-semibold disabled:opacity-50">{accepting ? 'Checking…' : 'Accept invitation'}</button>
            </form>
          </section>
        )}
        {workspaces.length > 0 && (
          <ul className="mt-8 space-y-4">
            {workspaces.map(workspace => (
              <li key={workspace.organizationId} className="rounded-xl border border-gray-800 bg-[#0d1424] p-5">
                <h2 className="text-xl font-semibold">{workspace.name}</h2>
                <p className="mt-2 text-sm uppercase tracking-wide text-gray-400">{workspace.role}</p>
                <p className="mt-3 text-gray-300">{packageSummary(workspace.packageId)}</p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
