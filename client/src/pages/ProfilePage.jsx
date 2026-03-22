import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Avatar from '../components/Avatar.jsx';

export default function ProfilePage() {
  const { user, setTheme } = useAuth();
  const dark = user?.theme === 'dark';

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Profile</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your account</p>

      <div className="mt-8 flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <Avatar user={user} size={10} />
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold text-slate-900 dark:text-white">{user?.name}</div>
          <div className="text-sm text-slate-600 dark:text-slate-300">{user?.email}</div>
          {user?.emailVerified ? (
            <span className="mt-1 inline-block rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
              Verified
            </span>
          ) : (
            <span className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
              Email not verified
            </span>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Appearance</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Syncs across devices when you sign in.</p>
        <button
          type="button"
          onClick={() => setTheme(dark ? 'light' : 'dark')}
          className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
        >
          {dark ? '☀️ Light mode' : '🌙 Dark mode'}
        </button>
      </div>

      <p className="mt-8 text-center text-sm">
        <Link to="/settings" className="text-violet-600 hover:underline dark:text-violet-400">
          Change password
        </Link>
      </p>
    </div>
  );
}
