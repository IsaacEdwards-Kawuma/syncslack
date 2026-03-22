import { Link, Outlet, useLocation } from 'react-router-dom';

export default function AppLayout() {
  const loc = useLocation();
  const showNav = loc.pathname !== '/';

  return (
    <div className="flex h-full min-h-0 flex-col bg-gradient-to-b from-slate-50 to-slate-100/80 dark:from-slate-950 dark:to-slate-900">
      {showNav ? (
        <header className="sticky top-0 z-20 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200/80 bg-white/75 px-3 py-3 shadow-soft backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-950/80 sm:px-4">
          <Link
            to="/"
            className="text-sm font-semibold text-violet-700 transition hover:text-violet-600 dark:text-violet-400 dark:hover:text-violet-300"
          >
            ← App
          </Link>
          <nav className="flex min-w-0 flex-1 flex-wrap gap-1 text-sm sm:flex-initial sm:gap-2">
            {[
              { to: '/settings', label: 'Settings' },
              { to: '/profile', label: 'Profile' },
              { to: '/help', label: 'Help' },
              { to: '/privacy', label: 'Privacy' },
            ].map(({ to, label }) => {
              const active = loc.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`rounded-lg px-2.5 py-1.5 transition ${
                    active
                      ? 'bg-violet-100 font-semibold text-violet-900 shadow-sm dark:bg-violet-950/60 dark:text-violet-100'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </header>
      ) : null}
      <div className="min-h-0 flex-1 motion-safe:animate-fade-in">
        <Outlet />
      </div>
    </div>
  );
}
