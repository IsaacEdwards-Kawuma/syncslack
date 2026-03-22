import { pool } from '../config/db.js';

export async function pinMessage(channelId, messageId, pinnedBy) {
  await pool.query(
    `INSERT INTO pinned_messages (channel_id, message_id, pinned_by) VALUES ($1, $2, $3)
     ON CONFLICT (channel_id, message_id) DO NOTHING`,
    [channelId, messageId, pinnedBy]
  );
}

export async function unpinMessage(channelId, messageId) {
  await pool.query(`DELETE FROM pinned_messages WHERE channel_id = $1 AND message_id = $2`, [
    channelId,
    messageId,
  ]);
}

export async function listPinnedMessageIds(channelId) {
  const r = await pool.query(
    `SELECT message_id FROM pinned_messages WHERE channel_id = $1 ORDER BY created_at ASC`,
    [channelId]
  );
  return r.rows.map((x) => x.message_id);
}
