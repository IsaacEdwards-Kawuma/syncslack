import { pool } from '../config/db.js';
import { isValidUuid } from '../utils/ids.js';
import * as workspaces from './workspaces.js';
import * as channels from './channels.js';
import * as conversations from './conversations.js';

async function canAccessMessageForUser(msgRow, userId) {
  if (msgRow.channel_id) {
    const ch = await channels.findChannelById(msgRow.channel_id);
    if (!ch) return false;
    if (!(await workspaces.isMember(ch.workspace_id, userId))) return false;
    if (ch.type === 'public') return true;
    const mids = await channels.listChannelMemberIds(ch.id);
    return mids.includes(userId);
  }
  if (msgRow.conversation_id) {
    return conversations.isConversationMember(msgRow.conversation_id, userId);
  }
  return false;
}

export async function createReminder({ userId, messageId, runAt }) {
  const uid = String(userId);
  if (!isValidUuid(messageId)) throw new Error('Invalid message id');
  const date = runAt ? new Date(runAt) : null;
  if (!date || Number.isNaN(date.getTime())) throw new Error('Invalid runAt');

  const { rows } = await pool.query(
    `
    SELECT m.*, ch.workspace_id AS channel_workspace_id, c.workspace_id AS conversation_workspace_id
    FROM messages m
    LEFT JOIN channels ch ON ch.id = m.channel_id
    LEFT JOIN conversations c ON c.id = m.conversation_id
    WHERE m.id = $1
    `,
    [messageId]
  );
  const msg = rows[0];
  if (!msg || msg.deleted_at) throw new Error('Message not found');
  if (!(await canAccessMessageForUser(msg, uid))) throw new Error('Not allowed');
  const workspaceId = msg.channel_workspace_id || msg.conversation_workspace_id;
  if (!workspaceId) throw new Error('Workspace not found');

  const r = await pool.query(
    `INSERT INTO reminders (user_id, workspace_id, message_id, run_at)
     VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [uid, workspaceId, messageId, date.toISOString()]
  );
  return r.rows[0];
}

export async function listDueReminders(nowIso, limit = 50) {
  const r = await pool.query(
    `
    SELECT rem.*,
           m.content AS message_content,
           m.attachment_url AS message_attachment_url,
           m.sender_id AS message_sender_id
    FROM reminders rem
    JOIN messages m ON m.id = rem.message_id
    WHERE rem.delivered_at IS NULL
      AND rem.run_at <= $1
    ORDER BY rem.run_at ASC
    LIMIT $2
    `,
    [nowIso, limit]
  );
  return r.rows;
}

export async function markReminderDelivered(reminderId) {
  await pool.query(`UPDATE reminders SET delivered_at = NOW() WHERE id = $1`, [reminderId]);
}

