import * as webhooks from '../db/webhooks.js';
import * as messages from '../db/messages.js';
import { formatMessageDoc } from '../socket/formatMessage.js';
import * as automations from '../db/automations.js';

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
    automations.runMessageAutomations({ workspaceId: hook.workspace_id, messageId: msg.id, actorUserId: hook.created_by }).catch(() => {});
    return res.json({ ok: true, messageId: msg.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'webhook failed' });
  }
}
