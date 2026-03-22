import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email } });
      setDone(true);
    } catch (err) {
      setError(err.message || 'Request failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-gradient-to-br from-violet-900 via-purple-900 to-slate-900 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white/95 p-8 shadow-xl dark:bg-slate-800/95">
        <h1 className="text-center text-2xl font-bold text-slate-800 dark:text-white">Reset password</h1>
        {done ? (
          <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-300">
            If an account exists for that email, we sent a reset link (check server logs if SMTP is not configured).
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {error ? (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
                {error}
              </div>
            ) : null}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-violet-700 py-2.5 font-semibold text-white disabled:opacity-60"
            >
              {pending ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}
        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="text-violet-600 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
