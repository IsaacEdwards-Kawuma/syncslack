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
    <div className="flex min-h-full flex-col items-center justify-center bg-gradient-to-br from-violet-900 via-purple-900 to-slate-900 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white/95 p-8 text-center shadow-xl dark:bg-slate-800/95">
        {status === 'pending' ? <p className="text-slate-600">Verifying…</p> : null}
        {status === 'ok' ? (
          <>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">Email verified</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">You can close this tab or sign in.</p>
          </>
        ) : null}
        {status === 'error' ? (
          <>
            <h1 className="text-xl font-bold text-red-700">Could not verify</h1>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
          </>
        ) : null}
        <Link to="/login" className="mt-6 inline-block text-violet-600 hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}
