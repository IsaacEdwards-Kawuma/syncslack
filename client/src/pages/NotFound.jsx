import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-16 dark:from-slate-950 dark:to-slate-900">
      <div className="motion-safe:animate-fade-in-up text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">Error</p>
        <h1 className="mt-2 bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-7xl font-bold tracking-tight text-transparent">
          404
        </h1>
        <p className="mt-4 max-w-sm text-slate-600 dark:text-slate-400">This page does not exist or was moved.</p>
      </div>
      <Link
        to="/"
        className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-2.5 font-semibold text-white shadow-md transition hover:from-violet-500 hover:to-indigo-500 hover:shadow-lg active:scale-[0.99]"
      >
        Back to app
      </Link>
    </div>
  );
}
