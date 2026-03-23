import { pool } from '../config/db.js';
import * as workspaces from './workspaces.js';
import * as channels from './channels.js';
import * as conversations from './conversations.js';
import { isValidUuid } from '../utils/ids.js';

function pickTitleFromMessage(m) {
  const t = String(m?.content || '').trim();
  if (t) return t.length > 120 ? `${t.slice(0, 120)}…` : t;
  return m?.attachmentUrl ? 'Attachment' : 'Message task';
}

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

export async function createTaskFromMessage({ userId, messageId, dueAt = null, assigneeUserId = null }) {
  if (!isValidUuid(messageId)) throw new Error('Invalid message id');
  const uid = String(userId);

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

  if (assigneeUserId && !isValidUuid(assigneeUserId)) throw new Error('Invalid assignee');

  const title = pickTitleFromMessage({
    content: msg.content,
    attachmentUrl: msg.attachment_url,
  });

  const prio = 3;
  const r = await pool.query(
    `INSERT INTO tasks (workspace_id, source_message_id, title, description, status, priority, due_at, assignee_user_id, created_by)
     VALUES ($1,$2,$3,$4,'open',$5,$6,$7,$8)
     RETURNING *`,
    [
      workspaceId,
      msg.id,
      title,
      String(msg.content || '').slice(0, 2000),
      prio,
      dueAt ? String(dueAt) : null,
      assigneeUserId || null,
      uid,
    ]
  );

  return r.rows[0];
}

export async function listPriorityTasks(workspaceId, userId, limit = 20) {
  const ws = String(workspaceId);
  const uid = String(userId);
  const l = Math.min(parseInt(limit, 10) || 20, 50);

  if (!isValidUuid(ws)) throw new Error('Invalid workspace id');
  if (!(await workspaces.isMember(ws, uid))) throw new Error('Not allowed');

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const r = await pool.query(
    `
    SELECT t.*,
           m.channel_id AS message_channel_id,
           m.conversation_id AS message_conversation_id
    FROM tasks t
    JOIN messages m ON m.id = t.source_message_id
    WHERE t.workspace_id = $1
      AND t.status != 'done'
      AND t.due_at IS NOT NULL
      AND t.due_at <= $2
      AND (t.assignee_user_id = $3::uuid OR t.assignee_user_id IS NULL OR t.created_by = $3::uuid)
    ORDER BY t.priority DESC, t.due_at ASC, t.updated_at DESC
    LIMIT $4
    `,
    [ws, in24h.toISOString(), uid, l]
  );

  return r.rows.map((t) => ({
    id: t.id,
    workspaceId: t.workspace_id,
    sourceMessageId: t.source_message_id,
    channelId: t.message_channel_id,
    conversationId: t.message_conversation_id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueAt: t.due_at,
    assigneeUserId: t.assignee_user_id,
    createdBy: t.created_by,
    createdAt: t.created_at,
  }));
}

export async function updateTaskStatus(taskId, userId, status) {
  if (!isValidUuid(taskId)) throw new Error('Invalid task id');
  const uid = String(userId);
  const s = String(status);
  if (!['open', 'in_progress', 'done'].includes(s)) throw new Error('Invalid status');

  const r = await pool.query(
    `
    UPDATE tasks
    SET status = $2, updated_at = NOW()
    WHERE id = $1
      AND (assignee_user_id = $3::uuid OR created_by = $3::uuid)
    RETURNING *`,
    [taskId, s, uid]
  );
  return r.rows[0] || null;
}

