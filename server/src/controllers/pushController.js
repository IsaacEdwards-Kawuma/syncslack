import * as pushSubscriptions from '../db/pushSubscriptions.js';

/** Public VAPID key for `PushManager.subscribe` (set `VAPID_PUBLIC_KEY` in env). */
export function getVapidPublic(req, res) {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() || null;
  return res.json({ publicKey });
}

export async function subscribePush(req, res) {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint?.trim()) return res.status(400).json({ error: 'endpoint is required' });
    await pushSubscriptions.upsertSubscription(req.user.sub, endpoint.trim(), keys || {});
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to save subscription' });
  }
}
