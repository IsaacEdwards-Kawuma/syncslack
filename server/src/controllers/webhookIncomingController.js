import * as webhooks from '../db/webhooks.js';
import * as messages from '../db/messages.js';
import { formatMessageDoc } from '../socket/formatMessage.js';
import * as automations from '../db/automations.js';
import * as users from '../db/users.js';
import { sendPushToUser } from '../services/webPush.js';

export async function incomingWebhook(req, res) {
  try {
    const { token } = req.params;
    const text = (req.body?.text || req.body?.content || '').trim();
    if (!text) return res.status(400).json({ error: 'text or content required' });
    const hook = await webhooks.findByToken(token);
    if (!hook) return res.status(404).json({ error: 'invalid webhook' });
    const msg = await messages.createChannelMessage({
      senderId: hook.created_by,
      channelId: hook.channel_id,
      content: text.slice(0, 8000),
      threadParentId: null,
      attachments: [],
    });
    const io = req.app.get('io');
    if (io) io.to(`channel:${hook.channel_id}`).emit('receive_message', formatMessageDoc(msg));
    const automationNotifs = await automations
      .runMessageAutomations({ workspaceId: hook.workspace_id, messageId: msg.id, actorUserId: hook.created_by })
      .catch(() => []);

    if (io && automationNotifs?.length) {
      const dndCache = new Map();
      for (const a of automationNotifs) {
        if (!a?.notifyUserId) continue;
        const uid = String(a.notifyUserId);
        if (!dndCache.has(uid)) {
          const u = await users.findUserById(a.notifyUserId);
          const active = Boolean(u?.dnd_until) && new Date(u.dnd_until) > new Date();
          dndCache.set(uid, active);
        }

        const dndActive = dndCache.get(uid);
        const preview = String(a.preview || '').slice(0, 120);
        const title = 'New automated task';
        const body = preview || a?.task?.title || 'Task created from a message';

        if (!dndActive) {
          io.to(`user:${a.notifyUserId}`).emit('notification', {
            type: 'task',
            workspaceId: a.workspaceId,
            messageId: a.messageId,
            notificationId: a.notificationId,
            preview,
            fromUserId: a.fromUserId,
          });
        }

        await sendPushToUser(a.notifyUserId, title, body, {
          type: 'task',
          messageId: a.messageId,
          workspaceId: a.workspaceId,
        });
      }
    }
    return res.json({ ok: true, messageId: msg.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'webhook failed' });
  }
}
