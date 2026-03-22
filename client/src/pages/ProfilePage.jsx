import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api, getApiBaseUrl, getToken } from '../lib/api.js';
import Avatar from '../components/Avatar.jsx';

export default function ProfilePage() {
  const { userId: routeUserId } = useParams();
  const [searchParams] = useSearchParams();
  const ws = searchParams.get('ws') || '';
  const { user, refresh, setTheme } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const isSelf = !routeUserId || routeUserId === user?.id;
  const [other, setOther] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [uploading, setUploading] = useState(false);
  const [statusText, setStatusText] = useState(user?.statusText || '');
  const [statusEmoji, setStatusEmoji] = useState(user?.statusEmoji || '');

  useEffect(() => {
    setStatusText(user?.statusText || '');
    setStatusEmoji(user?.statusEmoji || '');
  }, [user?.statusText, user?.statusEmoji]);

  useEffect(() => {
    if (isSelf) {
      setOther(null);
      setLoadErr('');
      return;
    }
    if (!ws || !routeUserId) {
      setLoadErr('Open this profile from the app (e.g. click a name in chat) so the workspace is included.');
      setOther(null);
      return;
    }
    let cancelled = false;
    api(`/workspaces/${ws}/members/${routeUserId}/profile`)
      .then((d) => {
        if (!cancelled) {
          setOther(d.profile);
          setLoadErr('');
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setLoadErr(e.message || 'Failed to load profile');
          setOther(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isSelf, routeUserId, ws]);

  async function saveStatus(e) {
    e.preventDefault();
    try {
      await api('/auth/me/status', { method: 'PATCH', body: { statusText, statusEmoji } });
      await refresh();
    } catch (err) {
      console.error(err);
    }
  }

  async function onPickAvatar(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) {
      alert('Please choose an image file.');
      return;
    }
    setUploading(true);
    try {
      const token = getToken();
      const base = getApiBaseUrl();
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${base}/api/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Upload failed');
        return;
      }
      await api('/auth/me/avatar', { method: 'PATCH', body: { avatarUrl: data.url } });
      await refresh();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Could not update photo');
    } finally {
      setUploading(false);
    }
  }

  function goMessage() {
    if (!ws || !other?.id) return;
    navigate('/', { state: { openDmWith: other.id, workspaceId: ws } });
  }

  const dark = user?.theme === 'dark';
  const displayProfile = isSelf ? user : other;

  return (
    <div className="mx-auto max-w-lg px-4 py-8 motion-safe:animate-fade-in-up">
      <p className="text-sm">
        <Link to="/" className="text-violet-600 hover:underline dark:text-violet-400">
          ← Back to app
        </Link>
      </p>

      {loadErr && !isSelf ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          {loadErr}
        </div>
      ) : null}

      <h1 className="mt-4 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-2xl font-bold text-transparent dark:from-white dark:to-slate-300">
        {isSelf ? 'Your profile' : displayProfile?.name || 'Profile'}
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {isSelf ? 'Your account' : 'Workspace member'}
      </p>

      {displayProfile ? (
        <div className="surface-card mt-8 flex flex-col gap-4 p-6 transition hover:shadow-soft-lg sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <Avatar user={displayProfile} size={10} />
            {isSelf ? (
              <>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {uploading ? 'Uploading…' : 'Change photo'}
                </button>
                <p className="max-w-[12rem] text-center text-[10px] text-slate-500 dark:text-slate-400 sm:text-left">
                  JPG, PNG, or GIF. Shown in chat and search.
                </p>
              </>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-semibold text-slate-900 dark:text-white">{displayProfile.name}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">{displayProfile.email}</div>
            {!isSelf && other?.role ? (
              <span className="mt-2 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                Role: {other.role}
              </span>
            ) : null}
            {isSelf && user?.emailVerified ? (
              <span className="mt-2 inline-block rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                Verified
              </span>
            ) : isSelf ? (
              <span className="mt-2 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                Email not verified
              </span>
            ) : null}
            {(displayProfile.statusEmoji || displayProfile.statusText) && (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                {displayProfile.statusEmoji ? `${displayProfile.statusEmoji} ` : ''}
                {displayProfile.statusText || ''}
              </p>
            )}
          </div>
        </div>
      ) : null}

      {isSelf ? (
        <form onSubmit={saveStatus} className="surface-card mt-6 p-6 transition hover:shadow-soft-lg">
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
          <button
            type="submit"
            className="mt-3 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-600"
          >
            Save status
          </button>
        </form>
      ) : null}

      {isSelf ? (
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
      ) : null}

      {!isSelf && other && ws ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={goMessage}
            className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:from-violet-500 hover:to-indigo-500"
          >
            Message
          </button>
        </div>
      ) : null}

      {isSelf ? (
        <p className="mt-8 text-center text-sm">
          <Link to="/settings" className="text-violet-600 hover:underline dark:text-violet-400">
            Change password
          </Link>
        </p>
      ) : null}
    </div>
  );
}
