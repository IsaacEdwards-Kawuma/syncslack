import * as reminders from '../db/reminders.js';
import * as notifications from '../db/notifications.js';
import * as users from '../db/users.js';
import { sendPushToUser } from './webPush.js';

export function startReminderWorker(io) {
  let running = false;
  const intervalMs = 25 * 1000;

  async function tick() {
    if (running) return;
    running = true;
    try {
      if (!io) return;
      const nowIso = new Date().toISOString();
      const due = await reminders.listDueReminders(nowIso, 50);
      for (const rem of due) {
        const previewBase = String(rem.message_content || '').trim();
        const preview = previewBase
          ? previewBase.length > 120
            ? `${previewBase.slice(0, 120)}…`
            : previewBase
          : rem.message_attachment_url
            ? 'Attachment'
            : 'Message';

        const n = await notifications.createNotification({
          userId: rem.user_id,
          type: 'reminder',
          workspaceId: rem.workspace_id,
          messageId: rem.message_id,
          title: 'Reminder',
          body: preview.slice(0, 200),
        });

        await reminders.markReminderDelivered(rem.id);

        const u = await users.findUserById(rem.user_id);
        const dndActive = Boolean(u?.dnd_until) && new Date(u.dnd_until) > new Date();
        if (!dndActive) {
          io.to(`user:${rem.user_id}`).emit('notification', {
            type: 'reminder',
            workspaceId: rem.workspace_id,
            messageId: rem.message_id,
            notificationId: n.id,
            preview,
            fromUserId: null,
          });
        }

        await sendPushToUser(rem.user_id, 'Reminder', preview, { type: 'reminder', messageId: rem.message_id });
      }
    } catch (e) {
      console.error('[reminderWorker] tick failed:', e?.message || e);
    } finally {
      running = false;
    }
  }

  // Run once on startup, then periodically.
  tick().catch(() => {});
  setInterval(() => tick().catch(() => {}), intervalMs);
}

