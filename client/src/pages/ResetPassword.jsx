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
      <div className="auth-page">
        <div className="auth-card text-center">
          <p className="text-slate-600 dark:text-slate-300">Missing token. Use the link from your email.</p>
          <Link to="/login" className="mt-6 inline-block font-medium text-violet-600 dark:text-violet-400">
            ← Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="text-center text-2xl font-bold text-slate-800 dark:text-white">New password</h1>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
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
            className="input-field mt-0"
          />
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? 'Saving…' : 'Set password'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="font-medium text-violet-600 transition hover:text-violet-500 dark:text-violet-400">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
