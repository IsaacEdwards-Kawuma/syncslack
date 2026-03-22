import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, password } });
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.message || 'Reset failed');
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <p className="text-slate-600">Missing token. Use the link from your email.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-gradient-to-br from-violet-900 via-purple-900 to-slate-900 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white/95 p-8 shadow-xl dark:bg-slate-800/95">
        <h1 className="text-center text-2xl font-bold text-slate-800 dark:text-white">New password</h1>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {error ? (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
              {error}
            </div>
          ) : null}
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password (8+ chars)"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-violet-700 py-2.5 font-semibold text-white disabled:opacity-60"
          >
            {pending ? 'Saving…' : 'Set password'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="text-violet-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
