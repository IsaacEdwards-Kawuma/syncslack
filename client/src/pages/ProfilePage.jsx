import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import Avatar from '../components/Avatar.jsx';

export default function ProfilePage() {
  const { user, setTheme, refresh } = useAuth();
  const dark = user?.theme === 'dark';
  const [statusText, setStatusText] = useState(user?.statusText || '');
  const [statusEmoji, setStatusEmoji] = useState(user?.statusEmoji || '');

  useEffect(() => {
    setStatusText(user?.statusText || '');
    setStatusEmoji(user?.statusEmoji || '');
  }, [user?.statusText, user?.statusEmoji]);

  async function saveStatus(e) {
    e.preventDefault();
    try {
      await api('/auth/me/status', { method: 'PATCH', body: { statusText, statusEmoji } });
      await refresh();
    } catch (err) {
      console.error(err);
    }
  }

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

      <form onSubmit={saveStatus} className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Status</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Shown to people in your workspaces.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={statusEmoji}
            onChange={(e) => setStatusEmoji(e.target.value)}
            maxLength={32}
            placeholder="Emoji"
            className="w-20 rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
          />
          <input
            value={statusText}
            onChange={(e) => setStatusText(e.target.value)}
            maxLength={140}
            placeholder="What’s your status?"
            className="min-w-[12rem] flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
          />
        </div>
        <button type="submit" className="mt-3 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-600">
          Save status
        </button>
      </form>

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
