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
    <div className="flex min-h-full flex-col items-center justify-center bg-gradient-to-br from-violet-900 via-purple-900 to-slate-900 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white/95 p-8 shadow-xl dark:bg-slate-800/95">
        <h1 className="text-center text-2xl font-bold text-slate-800 dark:text-white">Sync Work</h1>
        <p className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">
          Sign in to your workspace
        </p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          {error ? (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
              {error}
            </div>
          ) : null}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-violet-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-violet-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-violet-700 py-2.5 font-semibold text-white transition hover:bg-violet-600 disabled:opacity-60"
          >
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          <Link to="/forgot-password" className="text-violet-600 hover:underline">
            Forgot password?
          </Link>
        </p>
        <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
          No account?{' '}
          <Link to="/register" className="font-semibold text-violet-600 hover:underline">
            Create one
          </Link>
        </p>
        <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-500">
          <Link to="/help" className="hover:underline">
            Help
          </Link>
          {' · '}
          <Link to="/privacy" className="hover:underline">
            Privacy
          </Link>
        </p>
      </div>
    </div>
  );
}
