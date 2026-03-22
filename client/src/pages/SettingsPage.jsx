import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api, getApiBaseUrl } from '../lib/api.js';
import { LS_MESSAGE_PREVIEW } from '../lib/settingsPrefs.js';
import { enableBrowserPush, pushSupported } from '../lib/push.js';
import Avatar from '../components/Avatar.jsx';

export default function SettingsPage() {
  const { user, refresh, logout, setTheme } = useAuth();
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [workspaces, setWorkspaces] = useState([]);
  const [pushPending, setPushPending] = useState(false);
  const [messagePreviewInNotif, setMessagePreviewInNotif] = useState(() => {
    try {
      const v = localStorage.getItem(LS_MESSAGE_PREVIEW);
      return v !== '0';
    } catch {
      return true;
    }
  });

  const loadWs = useCallback(async () => {
    try {
      const { workspaces: list } = await api('/workspaces');
      setWorkspaces(list || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadWs();
  }, [loadWs]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_MESSAGE_PREVIEW, messagePreviewInNotif ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [messagePreviewInNotif]);

  function roleInWorkspace(ws) {
    return ws.members?.find((m) => m.userId === user?.id)?.role;
  }

  const dark = user?.theme === 'dark';
  const apiBase = getApiBaseUrl();
  const apiLabel = apiBase ? apiBase : 'Same origin (Vite dev proxy to API)';

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Account, appearance, notifications, and workspaces
      </p>

      {msg ? (
        <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
          {msg}
        </div>
      ) : null}
      {err ? (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
          {err}
        </div>
      ) : null}

      {/* Account */}
      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Account</h2>
        <div className="mt-4 flex items-start gap-4">
          <Avatar user={user} size={10} />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-slate-900 dark:text-white">{user?.name}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">{user?.email}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {user?.emailVerified ? (
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                  Email verified
                </span>
              ) : (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                  Email not verified
                </span>
              )}
            </div>
            <Link
              to="/profile"
              className="mt-3 inline-block text-sm font-medium text-violet-600 hover:underline dark:text-violet-400"
            >
              Edit profile →
            </Link>
          </div>
        </div>
      </section>

      {/* Appearance */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Appearance</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Synced to your account.</p>
        <button
          type="button"
          onClick={() => setTheme(dark ? 'light' : 'dark')}
          className="mt-4 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
        >
          {dark ? '☀️ Use light mode' : '🌙 Use dark mode'}
        </button>
      </section>

      {/* Privacy & help */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Privacy & help</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li>
            <Link to="/privacy" className="text-violet-600 hover:underline dark:text-violet-400">
              Privacy policy
            </Link>
            <span className="text-slate-500 dark:text-slate-400"> — how data is handled</span>
          </li>
          <li>
            <Link to="/help" className="text-violet-600 hover:underline dark:text-violet-400">
              Help &amp; shortcuts
            </Link>
            <span className="text-slate-500 dark:text-slate-400"> — search, mentions, calls</span>
          </li>
        </ul>
      </section>

      {/* Notification preferences (client) */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Notifications</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          In-app toast when you get a mention or DM while online.
        </p>
        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
            checked={messagePreviewInNotif}
            onChange={(e) => setMessagePreviewInNotif(e.target.checked)}
          />
          <span>
            <span className="font-medium text-slate-900 dark:text-white">Show message preview in notifications</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              Stored on this device. You can turn this off for more privacy on shared screens.
            </span>
          </span>
        </label>
      </section>

      {/* Password */}
      <form
        className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr('');
          setMsg('');
          try {
            await api('/auth/change-password', {
              method: 'POST',
              body: { currentPassword: pwdCurrent, newPassword: pwdNew },
            });
            setPwdCurrent('');
            setPwdNew('');
            setMsg('Password updated.');
          } catch (er) {
            setErr(er.message || 'Could not change password');
          }
        }}
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Change password</h2>
        <input
          type="password"
          value={pwdCurrent}
          onChange={(e) => setPwdCurrent(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
          placeholder="Current password"
          autoComplete="current-password"
        />
        <input
          type="password"
          value={pwdNew}
          onChange={(e) => setPwdNew(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
          placeholder="New password (8+ characters)"
          autoComplete="new-password"
        />
        <button type="submit" className="w-full rounded-lg bg-violet-700 py-2.5 font-semibold text-white hover:bg-violet-600">
          Update password
        </button>
      </form>

      {/* Browser push */}
      {pushSupported() ? (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Browser push</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Get alerts when this tab is in the background. Requires VAPID keys on the server (see server{' '}
            <code className="text-xs">.env.example</code>).
          </p>
          <button
            type="button"
            disabled={pushPending}
            className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-700"
            onClick={async () => {
              setErr('');
              setMsg('');
              setPushPending(true);
              try {
                const m = await enableBrowserPush();
                setMsg(m);
              } catch (e) {
                setErr(e.message || 'Could not enable push');
              } finally {
                setPushPending(false);
              }
            }}
          >
            {pushPending ? 'Working…' : 'Enable push on this device'}
          </button>
        </section>
      ) : (
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">Browser push is not supported here.</p>
      )}

      {/* Workspaces */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Workspaces</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Leave a workspace you no longer need. Owners must transfer ownership in the app (Admin) before leaving.
        </p>
        <ul className="mt-4 space-y-2">
          {workspaces.map((ws) => {
            const role = roleInWorkspace(ws);
            const canLeave = role && role !== 'owner';
            return (
              <li
                key={ws.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-600"
              >
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">{ws.name}</div>
                  <div className="text-xs text-slate-500">Your role: {role || '—'}</div>
                </div>
                {canLeave ? (
                  <button
                    type="button"
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
                    onClick={async () => {
                      if (!confirm(`Leave “${ws.name}”? You will need an invite to rejoin.`)) return;
                      setErr('');
                      setMsg('');
                      try {
                        await api(`/workspaces/${ws.id}/leave`, { method: 'POST' });
                        await loadWs();
                        await refresh();
                        setMsg(`Left ${ws.name}.`);
                      } catch (e) {
                        setErr(e.message || 'Could not leave');
                      }
                    }}
                  >
                    Leave
                  </button>
                ) : role === 'owner' ? (
                  <span className="text-xs text-slate-400">Transfer ownership in Admin to leave</span>
                ) : null}
              </li>
            );
          })}
        </ul>
        {workspaces.length === 0 ? <p className="mt-2 text-sm text-slate-500">No workspaces yet.</p> : null}
      </section>

      {/* Session */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Session</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Sign out on this browser. You will need to sign in again.</p>
        <button
          type="button"
          className="mt-4 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700"
          onClick={() => {
            if (confirm('Sign out of Sync Work on this device?')) logout();
          }}
        >
          Sign out
        </button>
      </section>

      {/* Connection (debug) */}
      <section className="mt-6 rounded-lg border border-dashed border-slate-200 p-4 text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400">
        <div className="font-semibold text-slate-600 dark:text-slate-300">Connection</div>
        <p className="mt-1 break-all">API base: {apiLabel}</p>
        <p className="mt-1">Useful if login or realtime fails—confirm <code className="rounded bg-slate-100 px-1 dark:bg-slate-700">VITE_API_URL</code> on Vercel matches your API host.</p>
      </section>
    </div>
  );
}
