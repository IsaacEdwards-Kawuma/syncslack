import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function StaticPageShell({ title, children }) {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-900">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
        {isAuthenticated ? (
          <Link to="/" className="text-sm font-semibold text-violet-700 hover:underline dark:text-violet-400">
            ← App
          </Link>
        ) : (
          <Link to="/login" className="text-sm font-semibold text-violet-700 hover:underline dark:text-violet-400">
            ← Sign in
          </Link>
        )}
        <nav className="flex gap-4 text-sm">
          <Link
            to="/help"
            className="text-slate-600 hover:underline dark:text-slate-400"
          >
            Help
          </Link>
          <Link
            to="/privacy"
            className="text-slate-600 hover:underline dark:text-slate-400"
          >
            Privacy
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">
        {title ? <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1> : null}
        {children}
      </main>
    </div>
  );
}
