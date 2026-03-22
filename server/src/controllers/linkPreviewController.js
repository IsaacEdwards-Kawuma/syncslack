/** Fetch Open Graph metadata for a URL (best-effort). */
export async function linkPreview(req, res) {
  try {
    const raw = req.query.url;
    if (!raw || typeof raw !== 'string') return res.status(400).json({ error: 'url required' });
    let u;
    try {
      u = new URL(raw.trim());
    } catch {
      return res.status(400).json({ error: 'invalid url' });
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return res.status(400).json({ error: 'invalid protocol' });
    const host = u.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
      return res.status(400).json({ error: 'not allowed' });
    }

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(u.href, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'SyncWork/1.0 (+https://github.com/IsaacEdwards-Kawuma/syncslack)' },
    });
    clearTimeout(t);
    if (!r.ok) return res.status(400).json({ error: 'fetch failed' });
    const html = await r.text();
    const og = (name) => {
      const a = html.match(
        new RegExp(`<meta[^>]+property=["']og:${name}["'][^>]+content=["']([^"']+)["']`, 'i')
      );
      const b = html.match(
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${name}["']`, 'i')
      );
      return (a || b)?.[1] || '';
    };
    const title =
      og('title') || (html.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1]?.trim() || '';
    const description = og('description') || '';
    const image = og('image') || '';
    return res.json({
      title: title.slice(0, 300),
      description: description.slice(0, 500),
      image: image.slice(0, 2000),
      url: u.href,
    });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: 'preview failed' });
  }
}
