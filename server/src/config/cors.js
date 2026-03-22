/**
 * Comma-separated CLIENT_ORIGIN in .env, e.g.
 * CLIENT_ORIGIN=http://localhost:5173,https://your-app.vercel.app
 *
 * Also allows HTTPS origins on *.vercel.app and *.vercel.dev so production
 * and preview deployments work without listing every preview URL.
 */
export function getCorsOrigins() {
  const raw = process.env.CLIENT_ORIGIN || process.env.CLIENT_ORIGINS || 'http://localhost:5173';
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : ['http://localhost:5173'];
}

/**
 * Used by Express and Socket.IO. Allows:
 * - No Origin (curl, same-origin, some clients)
 * - Exact match in CLIENT_ORIGIN
 * - https://*.vercel.app and https://*.vercel.dev (Vercel production + previews)
 * - http://localhost:* and http://127.0.0.1:* (dev)
 */
export function isOriginAllowed(origin) {
  if (!origin) return true;
  const list = getCorsOrigins();
  if (list.includes(origin)) return true;
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    if (u.protocol === 'http:' && (host === 'localhost' || host === '127.0.0.1')) {
      return true;
    }
    if (u.protocol === 'https:' && (host.endsWith('.vercel.app') || host.endsWith('.vercel.dev'))) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}
