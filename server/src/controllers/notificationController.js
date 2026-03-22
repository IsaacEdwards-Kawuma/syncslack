import * as notifications from '../db/notifications.js';

export async function listNotifications(req, res) {
  try {
    const list = await notifications.listForUser(req.user.sub, 80);
    return res.json({ notifications: list });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load notifications' });
  }
}

export async function markNotificationRead(req, res) {
  try {
    const ok = await notifications.markRead(req.user.sub, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed' });
  }
}

export async function markAllNotificationsRead(req, res) {
  try {
    await notifications.markAllRead(req.user.sub);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed' });
  }
}
