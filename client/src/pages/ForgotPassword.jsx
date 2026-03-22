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
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="text-center text-2xl font-bold text-slate-800 dark:text-white">Reset password</h1>
        {done ? (
          <p className="mt-4 text-center text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            If an account exists for that email, we sent a reset link (check server logs if SMTP is not configured).
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                {error}
              </div>
            ) : null}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="input-field mt-0"
            />
            <button type="submit" disabled={pending} className="btn-primary">
              {pending ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}
        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="font-medium text-violet-600 transition hover:text-violet-500 dark:text-violet-400">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
