/**
 * Comma-separated CLIENT_ORIGIN in .env, e.g.
 * CLIENT_ORIGIN=http://localhost:5173,https://your-app.vercel.app
 */
export function getCorsOrigins() {
  const raw = process.env.CLIENT_ORIGIN || process.env.CLIENT_ORIGINS || 'http://localhost:5173';
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : ['http://localhost:5173'];
}
