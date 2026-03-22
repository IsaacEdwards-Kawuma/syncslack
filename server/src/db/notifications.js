import { pool } from '../config/db.js';

export async function createNotification({ userId, type, workspaceId, messageId, title, body }) {
  const r = await pool.query(
    `INSERT INTO notifications (user_id, type, workspace_id, message_id, title, body)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, user_id, type, workspace_id, message_id, title, body, read_at, created_at`,
    [userId, type, workspaceId || null, messageId || null, title || '', body || '']
  );
  return formatRow(r.rows[0]);
}

function formatRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    workspaceId: row.workspace_id,
    messageId: row.message_id,
    title: row.title,
    body: row.body,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export async function listForUser(userId, limit = 50) {
  const r = await pool.query(
    `SELECT id, user_id, type, workspace_id, message_id, title, body, read_at, created_at
     FROM notifications WHERE user_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return r.rows.map(formatRow);
}

export async function markRead(userId, notificationId) {
  const r = await pool.query(
    `UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING id`,
    [notificationId, userId]
  );
  return r.rowCount > 0;
}

export async function markAllRead(userId) {
  await pool.query(`UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`, [userId]);
}
