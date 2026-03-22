import { pool } from '../config/db.js';

export async function saveMessage(userId, messageId) {
  await pool.query(
    `INSERT INTO saved_messages (user_id, message_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, messageId]
  );
}

export async function unsaveMessage(userId, messageId) {
  await pool.query(`DELETE FROM saved_messages WHERE user_id = $1 AND message_id = $2`, [userId, messageId]);
}

export async function listSavedMessageIds(userId, limit = 50) {
  const r = await pool.query(
    `SELECT message_id FROM saved_messages WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, Math.min(limit, 100)]
  );
  return r.rows.map((x) => x.message_id);
}
