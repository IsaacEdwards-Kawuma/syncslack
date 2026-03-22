import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function StaticPageShell({ title, children }) {
  const { isAuthenticated } = useAuth();

  return (
    <div className="relative min-h-full overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.45] dark:opacity-25"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 100% 0%, rgba(139, 92, 246, 0.12), transparent), radial-gradient(ellipse 60% 40% at 0% 100%, rgba(99, 102, 241, 0.1), transparent)',
        }}
      />
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200/80 bg-white/80 px-3 py-3 shadow-soft backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-950/85 sm:px-4">
        {isAuthenticated ? (
          <Link
            to="/"
            className="text-sm font-semibold text-violet-700 transition hover:text-violet-600 dark:text-violet-400 dark:hover:text-violet-300"
          >
            ← App
          </Link>
        ) : (
          <Link
            to="/login"
            className="text-sm font-semibold text-violet-700 transition hover:text-violet-600 dark:text-violet-400 dark:hover:text-violet-300"
          >
            ← Sign in
          </Link>
        )}
        <nav className="flex gap-2 text-sm">
          <Link
            to="/help"
            className="rounded-lg px-2 py-1 text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Help
          </Link>
          <Link
            to="/privacy"
            className="rounded-lg px-2 py-1 text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Privacy
          </Link>
        </nav>
      </header>
      <main className="relative mx-auto max-w-2xl px-3 py-8 motion-safe:animate-fade-in-up sm:px-4 sm:py-10">
        {title ? (
          <h1 className="bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-2xl font-bold tracking-tight text-transparent dark:from-white dark:to-slate-300">
            {title}
          </h1>
        ) : null}
        {children}
      </main>
    </div>
  );
}
