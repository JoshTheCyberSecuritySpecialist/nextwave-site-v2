import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, AlertCircle } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { signIn, resetPassword } = useAuth();
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (mode === 'reset') {
        const { error } = await resetPassword(email);
        if (error) throw error;
        setMessage('Password reset email sent. Check your inbox.');
        setEmail('');
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        navigate('/admin');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0F1E] via-[#0d1424] to-[#0A0F1E] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-[#0d1424] rounded-2xl shadow-2xl border border-gray-800 p-8">
          <div className="text-center mb-8">
            <img
              src="/nextwave_smoothblue.png"
              alt="NextWave Digital Solutions"
              className="h-12 mx-auto mb-6"
            />
            <h1 className="text-2xl font-bold text-white mb-2">
              {mode === 'reset' ? 'Reset Password' : 'Admin Login'}
            </h1>
            <p className="text-gray-400 text-sm">
              {mode === 'reset'
                ? 'Enter your admin email to receive a reset link'
                : 'Sign in with admin credentials to access the dashboard'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {message && (
            <div className="mb-6 p-4 bg-[#2283B8]/10 border border-[#2283B8]/30 rounded-lg">
              <p className="text-[#2283B8] text-sm">{message}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-[#0A0F1E] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#2283B8] transition-colors"
                  placeholder="you@company.com"
                  required
                />
              </div>
            </div>

            {mode !== 'reset' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-[#0A0F1E] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#2283B8] transition-colors"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
              </div>
            )}

            {mode === 'login' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setMode('reset')}
                  className="text-sm text-[#2283B8] hover:text-[#1a6a94] transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#2283B8] text-white font-medium rounded-lg hover:bg-[#1a6a94] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? 'Please wait...'
                : mode === 'reset'
                ? 'Send Reset Link'
                : 'Sign In'}
            </button>
          </form>

          {mode === 'reset' && (
            <div className="mt-6 text-center">
              <p className="text-gray-400 text-sm">
                Remember your password?{' '}
                <button
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setMessage('');
                  }}
                  className="text-[#2283B8] hover:text-[#1a6a94] font-medium transition-colors"
                >
                  Back to Login
                </button>
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <p className="text-gray-500 text-xs">
            Secure authentication powered by Supabase
          </p>
        </div>
      </div>
    </div>
  );
}
