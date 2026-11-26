import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { acceptInvitation, previewInvitation, setupInvitedAccount } from '../lib/crm';
import { supabase } from '../lib/supabase';

const TOKEN = /^[a-f0-9]{64}$/;

export default function CrmInvite() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = useMemo(() => {
    const value = (params.get('token') ?? '').trim().toLowerCase();
    return TOKEN.test(value) ? value : '';
  }, [params]);
  const { session, user, loading: sessionLoading } = useAuth();
  const [preview, setPreview] = useState<{ email: string; organizationName?: string } | null>(null);
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'loading' | 'setup' | 'signin' | 'accept'>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setError('This invitation link is missing or invalid.');
      setMode('setup');
      return;
    }
    let stopped = false;
    setError('');
    previewInvitation(token)
      .then(next => {
        if (stopped) return;
        setPreview({ email: next.email, organizationName: next.organizationName });
      })
      .catch(reason => {
        if (!stopped) setError(reason instanceof Error ? reason.message : 'The invitation could not be loaded.');
      })
      .finally(() => {
        if (!stopped && !sessionLoading) {
          /* mode resolved below */
        }
      });
    return () => { stopped = true; };
  }, [token, sessionLoading]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!token || error) {
      setMode('setup');
      return;
    }
    if (!preview) return;
    if (user?.email?.toLowerCase() === preview.email) {
      setMode('accept');
      return;
    }
    if (user) {
      setError('Sign out of the current account before accepting this invitation.');
      setMode('signin');
      return;
    }
    setMode('setup');
  }, [sessionLoading, token, error, preview, user]);

  async function onSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !preview) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await setupInvitedAccount(token, password);
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: result.email,
        password,
      });
      if (signInError) throw signInError;
      if (!result.created) setMessage('Account already existed. Signed in with the password you entered.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Account setup failed.');
      setMode('signin');
    } finally {
      setBusy(false);
    }
  }

  async function onSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview) return;
    setBusy(true);
    setError('');
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: preview.email,
        password,
      });
      if (signInError) throw signInError;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  async function onAccept() {
    if (!session?.access_token || !token) return;
    setBusy(true);
    setError('');
    try {
      await acceptInvitation(session.access_token, token);
      navigate('/crm', { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The invitation could not be accepted.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0F1E] px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#0d1424] p-8">
        <img src="/nextwave_smoothblue.png" alt="NextWave Digital Solutions" className="mx-auto mb-6 h-12" />
        <h1 className="text-center text-2xl font-bold text-white">Workspace invitation</h1>
        <p className="mt-2 text-center text-sm text-gray-400">
          {preview?.organizationName
            ? `Join ${preview.organizationName}. Creating an account alone does not grant access until you accept.`
            : 'Create or sign in to the invited account, then accept access.'}
        </p>
        {error && <p role="alert" className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}
        {message && <p role="status" className="mt-6 rounded-lg border border-[#2283B8]/30 bg-[#2283B8]/10 p-4 text-sm text-[#7dd3f5]">{message}</p>}

        {mode === 'loading' && <p className="mt-6 text-center text-sm text-gray-400">Checking invitation…</p>}

        {mode === 'setup' && preview && (
          <form className="mt-6 space-y-5" onSubmit={onSetup}>
            <div>
              <label htmlFor="invite-email" className="mb-2 block text-sm font-medium text-gray-300">Invited email</label>
              <input id="invite-email" type="email" readOnly value={preview.email} className="min-h-11 w-full rounded-lg border border-gray-700 bg-[#0A0F1E] px-3 text-gray-300" />
            </div>
            <div>
              <label htmlFor="invite-password" className="mb-2 block text-sm font-medium text-gray-300">Create password</label>
              <input id="invite-password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} className="min-h-11 w-full rounded-lg border border-gray-700 bg-[#0A0F1E] px-3 text-white" />
            </div>
            <button type="submit" disabled={busy || !token} className="min-h-11 w-full rounded-lg bg-[#2283B8] px-4 font-semibold disabled:opacity-50">
              {busy ? 'Working…' : 'Create account and continue'}
            </button>
            <button type="button" className="min-h-11 w-full rounded-lg border border-gray-700 px-4 text-sm text-gray-300" onClick={() => setMode('signin')}>
              I already have an account
            </button>
          </form>
        )}

        {mode === 'signin' && preview && (
          <form className="mt-6 space-y-5" onSubmit={onSignIn}>
            <div>
              <label htmlFor="signin-email" className="mb-2 block text-sm font-medium text-gray-300">Email</label>
              <input id="signin-email" type="email" readOnly value={preview.email} className="min-h-11 w-full rounded-lg border border-gray-700 bg-[#0A0F1E] px-3 text-gray-300" />
            </div>
            <div>
              <label htmlFor="signin-password" className="mb-2 block text-sm font-medium text-gray-300">Password</label>
              <input id="signin-password" type="password" required minLength={8} maxLength={72} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="min-h-11 w-full rounded-lg border border-gray-700 bg-[#0A0F1E] px-3 text-white" />
            </div>
            <button type="submit" disabled={busy} className="min-h-11 w-full rounded-lg bg-[#2283B8] px-4 font-semibold disabled:opacity-50">
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}

        {mode === 'accept' && preview && (
          <div className="mt-6 space-y-5">
            <p className="text-sm text-gray-300">Signed in as {preview.email}. Accept to join the workspace.</p>
            <button type="button" disabled={busy} onClick={() => { void onAccept(); }} className="min-h-11 w-full rounded-lg bg-[#2283B8] px-4 font-semibold disabled:opacity-50">
              {busy ? 'Accepting…' : 'Accept invitation'}
            </button>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          <Link to="/crm/login" className="text-[#7dd3f5] hover:underline">Workspace sign in</Link>
        </p>
      </div>
    </div>
  );
}
