import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 px-4 py-16">
      <h1 className="text-4xl font-bold text-slate-800 dark:text-white">404</h1>
      <p className="text-center text-slate-600 dark:text-slate-400">This page does not exist.</p>
      <Link to="/" className="rounded-lg bg-violet-700 px-4 py-2 font-semibold text-white hover:bg-violet-600">
        Back to app
      </Link>
    </div>
  );
}
