import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">Sync Work</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-800 dark:text-white">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Sign in to your workspace</p>
        </div>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </div>
          ) : null}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
            />
          </div>
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          <Link to="/forgot-password" className="font-medium text-violet-600 transition hover:text-violet-500 dark:text-violet-400">
            Forgot password?
          </Link>
        </p>
        <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
          No account?{' '}
          <Link to="/register" className="font-semibold text-violet-600 transition hover:text-violet-500 dark:text-violet-400">
            Create one
          </Link>
        </p>
        <p className="mt-8 text-center text-xs text-slate-500 dark:text-slate-500">
          <Link to="/help" className="transition hover:text-violet-600 dark:hover:text-violet-400">
            Help
          </Link>
          {' · '}
          <Link to="/privacy" className="transition hover:text-violet-600 dark:hover:text-violet-400">
            Privacy
          </Link>
        </p>
      </div>
    </div>
  );
}
