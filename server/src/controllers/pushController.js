import * as pushSubscriptions from '../db/pushSubscriptions.js';

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
