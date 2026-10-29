import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function CrmLogin() {
  const { user, loading: sessionLoading } = useAuth();
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  if (!sessionLoading && user) return <Navigate to="/crm" replace />;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      if (mode === 'reset') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim());
        if (resetError) throw resetError;
        setMessage('If an account exists for that email, a reset link is on the way.');
        setEmail('');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0F1E] px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#0d1424] p-8">
        <img src="/nextwave_smoothblue.png" alt="NextWave Digital Solutions" className="mx-auto mb-6 h-12" />
        <h1 className="text-center text-2xl font-bold text-white">{mode === 'reset' ? 'Reset password' : 'Workspace sign in'}</h1>
        <p className="mt-2 text-center text-sm text-gray-400">
          {mode === 'reset' ? 'Enter the email for your workspace account.' : 'Sign in to the business workspace you were invited to.'}
        </p>
        {error && <p role="alert" className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}
        {message && <p role="status" className="mt-6 rounded-lg border border-[#2283B8]/30 bg-[#2283B8]/10 p-4 text-sm text-[#7dd3f5]">{message}</p>}
        <form className="mt-6 space-y-5" onSubmit={onSubmit}>
          <div>
            <label htmlFor="crm-email" className="mb-2 block text-sm font-medium text-gray-300">Email</label>
            <input id="crm-email" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} className="min-h-11 w-full rounded-lg border border-gray-700 bg-[#0A0F1E] px-3 text-white" />
          </div>
          {mode === 'login' && (
            <div>
              <label htmlFor="crm-password" className="mb-2 block text-sm font-medium text-gray-300">Password</label>
              <input id="crm-password" type="password" autoComplete="current-password" required minLength={6} value={password} onChange={event => setPassword(event.target.value)} className="min-h-11 w-full rounded-lg border border-gray-700 bg-[#0A0F1E] px-3 text-white" />
            </div>
          )}
          {mode === 'login' && (
            <button type="button" className="text-sm text-[#7dd3f5]" onClick={() => { setMode('reset'); setError(''); setMessage(''); }}>Forgot password?</button>
          )}
          <button type="submit" disabled={loading} className="min-h-11 w-full rounded-lg bg-[#2283B8] font-semibold text-white disabled:opacity-50">
            {loading ? 'Please wait…' : mode === 'reset' ? 'Send reset link' : 'Sign in'}
          </button>
        </form>
        {mode === 'reset' && (
          <button type="button" className="mt-6 text-sm text-[#7dd3f5]" onClick={() => { setMode('login'); setError(''); setMessage(''); }}>Back to sign in</button>
        )}
      </div>
    </div>
  );
}
