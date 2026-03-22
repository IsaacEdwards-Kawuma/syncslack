import { getPublicAssetUrl } from '../lib/api.js';

const sizeMap = {
  8: 'h-8 w-8 text-[10px]',
  9: 'h-9 w-9 text-xs',
  10: 'h-10 w-10 text-sm',
};

export default function Avatar({ user, size = 9 }) {
  const initials = (user?.name || user?.email || '?')
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const dim = sizeMap[size] || sizeMap[9];
  if (user?.avatarUrl) {
    return (
      <img
        src={getPublicAssetUrl(user.avatarUrl)}
        alt=""
        className={`inline-block shrink-0 rounded object-cover ring-2 ring-white/40 dark:ring-slate-700/80 ${dim.split(' ').slice(0, 2).join(' ')}`}
      />
    );
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded bg-gradient-to-br from-violet-500 to-indigo-600 font-semibold text-white shadow-sm ring-2 ring-white/30 dark:ring-slate-700/60 ${dim}`}
    >
      {initials}
    </div>
  );
}
