import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState('pending');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Missing token');
      return;
    }
    (async () => {
      try {
        await api(`/auth/verify-email?token=${encodeURIComponent(token)}`);
        setStatus('ok');
      } catch (e) {
        setStatus('error');
        setError(e.message || 'Verification failed');
      }
    })();
  }, [token]);

  return (
    <div className="auth-page">
      <div className="auth-card text-center">
        {status === 'pending' ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-600 dark:border-violet-400/25 dark:border-t-violet-400" />
            <p className="text-slate-600 dark:text-slate-300">Verifying…</p>
          </div>
        ) : null}
        {status === 'ok' ? (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400/20 to-teal-500/10 text-4xl motion-safe:animate-float">
              ✓
            </div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">Email verified</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">You can close this tab or sign in.</p>
          </>
        ) : null}
        {status === 'error' ? (
          <>
            <h1 className="text-xl font-bold text-red-700 dark:text-red-400">Could not verify</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{error}</p>
          </>
        ) : null}
        {status !== 'pending' ? (
          <Link
            to="/login"
            className="mt-8 inline-block rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:from-violet-500 hover:to-indigo-500"
          >
            Sign in
          </Link>
        ) : null}
      </div>
    </div>
  );
}
