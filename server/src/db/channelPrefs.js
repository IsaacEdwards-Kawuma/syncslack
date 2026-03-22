import { pool } from '../config/db.js';

export async function getLevel(userId, channelId) {
  const r = await pool.query(
    `SELECT level FROM channel_notification_prefs WHERE user_id = $1 AND channel_id = $2`,
    [userId, channelId]
  );
  return r.rows[0]?.level || 'all';
}

export async function setLevel(userId, channelId, level) {
  if (!['all', 'mentions', 'mute'].includes(level)) return null;
  await pool.query(
    `INSERT INTO channel_notification_prefs (user_id, channel_id, level) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, channel_id) DO UPDATE SET level = EXCLUDED.level`,
    [userId, channelId, level]
  );
  return getLevel(userId, channelId);
}

export async function isChannelMuted(userId, channelId) {
  const lvl = await getLevel(userId, channelId);
  return lvl === 'mute';
}
