// LoginPage.jsx — the entry point of the app.
// Has a normal email/password form plus a "Try a demo account" shortcut row.

import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Factory, Loader2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';

// Demo accounts for quick testing (password is the same for all)
const DEMO_ACCOUNTS = [
  { label: 'Requester', email: 'requester@factoryflow.dev' },
  { label: 'Approver',  email: 'approver@factoryflow.dev'  },
  { label: 'Store',     email: 'store@factoryflow.dev'     },
  { label: 'Admin',     email: 'admin@factoryflow.dev'     },
];
const DEMO_PASSWORD = 'Demo@123';

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  // Already logged in? Go straight to dashboard
  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // One-click demo login
  async function handleDemo(demoEmail) {
    setError('');
    setLoading(true);
    try {
      await login(demoEmail, DEMO_PASSWORD);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur mb-4">
            <Factory className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">FactoryFlow</h1>
          <p className="text-brand-200 mt-1 text-sm">Raw material tracking for fermentation labs</p>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Sign in to your account</h2>

          <ErrorMessage message={error} />

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@factoryflow.dev"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition text-sm"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition text-sm"
              />
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-medium rounded-xl transition-colors text-sm"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Demo accounts shortcut */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-3 text-center">
              Try a demo account (password: Demo@123)
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.label}
                  id={`demo-${acc.label.toLowerCase()}`}
                  onClick={() => handleDemo(acc.email)}
                  disabled={loading}
                  className="py-2 px-3 text-xs font-medium rounded-lg border border-gray-200 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 text-gray-600 transition-colors disabled:opacity-50"
                >
                  {acc.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
