import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { enableBrowserPush, pushSupported } from '../lib/push.js';

export default function SettingsPage() {
  const { user, refresh } = useAuth();
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [workspaces, setWorkspaces] = useState([]);
  const [pushPending, setPushPending] = useState(false);

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

  function roleInWorkspace(ws) {
    return ws.members?.find((m) => m.userId === user?.id)?.role;
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Account and workspace membership</p>

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

      <form
        className="mt-8 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800"
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

      {pushSupported() ? (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Browser notifications</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Enable push for this device after the server is configured with VAPID keys (see server <code className="text-xs">.env.example</code>).
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
        </div>
      ) : (
        <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">Push notifications are not supported in this browser.</p>
      )}

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
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
      </div>
    </div>
  );
}
