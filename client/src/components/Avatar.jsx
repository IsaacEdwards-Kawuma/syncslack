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
        className={`inline-block shrink-0 rounded object-cover ${dim.split(' ').slice(0, 2).join(' ')}`}
      />
    );
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded bg-violet-600 font-semibold text-white ${dim}`}
    >
      {initials}
    </div>
  );
}
