const TOKEN_KEY = 'syncwork_token';

/** Base URL of the API (Render), no trailing slash. Empty = same origin (Vite dev proxy). */
export function getApiBaseUrl() {
  const raw = import.meta.env.VITE_API_URL;
  if (!raw || typeof raw !== 'string') return '';
  return raw.replace(/\/$/, '');
}

/** Turn `/uploads/...` into full URL when the API is on another host (production). */
export function getPublicAssetUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = getApiBaseUrl();
  if (base) return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  return path;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const base = getApiBaseUrl();
  const url = `${base}/api${path}`;
  const res = await fetch(url, {
    ...options,
    headers,
    body:
      options.body && !(options.body instanceof FormData)
        ? JSON.stringify(options.body)
        : options.body,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
