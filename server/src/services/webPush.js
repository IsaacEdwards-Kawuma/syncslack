import webpush from 'web-push';
import * as pushSubscriptions from '../db/pushSubscriptions.js';
import * as users from '../db/users.js';

const vapidPublic = process.env.VAPID_PUBLIC_KEY?.trim();
const vapidPrivate = process.env.VAPID_PRIVATE_KEY?.trim();
const vapidSubject = process.env.VAPID_SUBJECT?.trim() || 'mailto:noreply@localhost';

let configured = false;
if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  configured = true;
}

export function isWebPushConfigured() {
  return configured;
}

/** Send Web Push to all subscriptions for a user (best-effort; invalid subs removed). */
export async function sendPushToUser(userId, title, body, data = {}) {
  if (!configured) return;
  const u = await users.findUserById(userId);
  if (u?.dnd_until) {
    const t = new Date(u.dnd_until);
    if (!Number.isNaN(t.getTime()) && t > new Date()) return;
  }
  const rows = await pushSubscriptions.listEndpointsForUser(userId);
  const payload = JSON.stringify({ title, body, ...data });
  for (const row of rows) {
    let keys = row.keys;
    if (typeof keys === 'string') {
      try {
        keys = JSON.parse(keys);
      } catch {
        keys = {};
      }
    }
    const sub = { endpoint: row.endpoint, keys: keys || {} };
    try {
      await webpush.sendNotification(sub, payload);
    } catch (e) {
      const code = e?.statusCode;
      if (code === 410 || code === 404) {
        await pushSubscriptions.deleteByEndpoint(row.endpoint).catch(() => {});
      }
    }
  }
}
