import { Link, Outlet, useLocation } from 'react-router-dom';

export default function AppLayout() {
  const loc = useLocation();
  const showNav = loc.pathname !== '/';

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50 dark:bg-slate-900">
      {showNav ? (
        <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-950 sm:px-4">
          <Link to="/" className="text-sm font-semibold text-violet-700 hover:underline dark:text-violet-400">
            ← App
          </Link>
          <nav className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-1 text-sm sm:flex-initial">
            <Link
              to="/settings"
              className={`hover:underline ${loc.pathname === '/settings' ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}
            >
              Settings
            </Link>
            <Link
              to="/profile"
              className={`hover:underline ${loc.pathname === '/profile' ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}
            >
              Profile
            </Link>
            <Link
              to="/help"
              className={`hover:underline ${loc.pathname === '/help' ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}
            >
              Help
            </Link>
            <Link
              to="/privacy"
              className={`hover:underline ${loc.pathname === '/privacy' ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}
            >
              Privacy
            </Link>
          </nav>
        </header>
      ) : null}
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
