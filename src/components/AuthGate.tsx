import React, { useState } from 'react';
import {
  AlertCircle,
  Cpu,
  Eye,
  EyeOff,
  Lock,
  Scale,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import {
  mapFirebaseAuthError,
  signInAsGuest,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '../lib/firebase';

type AuthTab = 'signin' | 'signup';

export function AuthGate() {
  const [tab, setTab] = useState<AuthTab>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Please enter a valid work or personal email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (tab === 'signup' && fullName.trim().length < 2) {
      setError('Please enter your full name to create an account.');
      return;
    }

    setLoading(true);
    try {
      if (tab === 'signin') {
        await signInWithEmail(trimmedEmail, password);
      } else {
        await signUpWithEmail(fullName, trimmedEmail, password);
      }
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInAsGuest();
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 grid grid-cols-1 lg:grid-cols-12">
      {/* Left Panel: Executive Navy Value Proposition */}
      <aside className="lg:col-span-5 bg-slate-900 text-slate-100 p-8 sm:p-12 lg:p-14 flex flex-col justify-between gap-12">
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
              <Scale className="w-5 h-5 text-amber-500" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white font-display">
              ClauseGuard
            </span>
          </div>

          <div className="space-y-4">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-snug text-balance">
              Zero-Leakage Contract Intelligence for Legal, Procurement &amp; Tenancy Review.
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed max-w-md">
              Evaluate complex agreements with on-device Gemini Nano inference while ensuring sensitive identity records never leave your workstation.
            </p>
          </div>

          <div className="space-y-5 pt-4 border-t border-slate-800">
            <div className="flex items-start gap-3.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Client-Side PII Redaction
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  MyKad, passport, phone, bank account, and address identifiers are masked deterministically before any cloud request.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <Cpu className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Hybrid On-Device AI
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Local Gemini Nano execution via Firebase AI Logic with offline continuity and zero per-token cost.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Encrypted Audit Trail
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Role-scoped Firestore persistence protected by verified authentication rules and strict schema validation.
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Split-Compute Hybrid Architecture · Firebase AI Logic + Cloud Counter-Drafting
        </p>
      </aside>

      {/* Right Panel: Clean White Auth Card */}
      <main className="lg:col-span-7 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 space-y-6">
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {tab === 'signin' ? 'Sign in to ClauseGuard' : 'Create your workspace account'}
            </h2>
            <p className="text-xs text-slate-600">
              {tab === 'signin'
                ? 'Access your contract audit workbench and redacted negotiation archive.'
                : 'Register with your email to persist redacted contract reviews.'}
            </p>
          </div>

          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setTab('signin');
                setError(null);
              }}
              className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                tab === 'signin'
                  ? 'bg-white text-slate-900 border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('signup');
                setError(null);
              }}
              className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                tab === 'signup'
                  ? 'bg-white text-slate-900 border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-900"
            >
              <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'signup' && (
              <div>
                <label
                  htmlFor="auth-full-name"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Full Name
                </label>
                <input
                  id="auth-full-name"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nurul Aina binti Hassan"
                  className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Work or Personal Email
              </label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="counsel@company.com"
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
              />
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full pl-3.5 pr-10 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading
                ? 'Authenticating...'
                : tab === 'signin'
                  ? 'Sign In'
                  : 'Create Account'}
            </button>
          </form>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-xs text-slate-400 whitespace-nowrap">
              or continue with
            </span>
            <div className="border-t border-slate-200 w-full" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full py-2.5 px-4 text-sm font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="pt-2 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={handleGuest}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 underline underline-offset-4 cursor-pointer disabled:opacity-50"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Continue as Guest Reviewer (Anonymous Session)
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
