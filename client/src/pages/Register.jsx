import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      await register(email, password, name);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">Sync Work</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-800 dark:text-white">Create account</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Start collaborating with your team</p>
        </div>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </div>
          ) : null}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Display name
            </label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Email
            </label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Password (min 8 chars)
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
            />
          </div>
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-violet-600 transition hover:text-violet-500 dark:text-violet-400">
            Sign in
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
