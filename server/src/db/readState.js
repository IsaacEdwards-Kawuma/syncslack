import { pool } from '../config/db.js';

export async function markChannelRead(userId, channelId) {
  await pool.query(
    `INSERT INTO user_channel_reads (user_id, channel_id, last_read_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id, channel_id) DO UPDATE SET last_read_at = NOW()`,
    [userId, channelId]
  );
}

export async function markConversationRead(userId, conversationId) {
  await pool.query(
    `INSERT INTO user_conversation_reads (user_id, conversation_id, last_read_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id, conversation_id) DO UPDATE SET last_read_at = NOW()`,
    [userId, conversationId]
  );
}

export async function getUnreadChannelIds(workspaceId, userId) {
  const { rows } = await pool.query(
    `SELECT c.id AS channel_id,
            COALESCE(ucr.last_read_at, 'epoch'::timestamptz) AS last_read_at
     FROM channels c
     LEFT JOIN user_channel_reads ucr ON ucr.channel_id = c.id AND ucr.user_id = $2
     WHERE c.workspace_id = $1`,
    [workspaceId, userId]
  );
  const unread = [];
  for (const row of rows) {
    const { rows: c2 } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM messages m
       WHERE m.channel_id = $1 AND m.deleted_at IS NULL AND m.created_at > $2`,
      [row.channel_id, row.last_read_at]
    );
    if (c2[0].n > 0) unread.push(row.channel_id);
  }
  return unread;
}

export async function getUnreadSummaryForWorkspace(workspaceId, userId) {
  const channelIds = await getUnreadChannelIds(workspaceId, userId);
  const { rows } = await pool.query(
    `SELECT c.id AS conversation_id,
            COALESCE(ucr.last_read_at, 'epoch'::timestamptz) AS last_read_at
     FROM conversation_members cm
     JOIN conversations c ON c.id = cm.conversation_id AND c.workspace_id = $1
     LEFT JOIN user_conversation_reads ucr
       ON ucr.conversation_id = c.id AND ucr.user_id = $2
     WHERE cm.user_id = $2`,
    [workspaceId, userId]
  );
  const unreadConv = [];
  for (const row of rows) {
    const { rows: c2 } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM messages m
       WHERE m.conversation_id = $1 AND m.deleted_at IS NULL AND m.created_at > $2`,
      [row.conversation_id, row.last_read_at]
    );
    if (c2[0].n > 0) unreadConv.push(row.conversation_id);
  }
  return { unreadChannels: channelIds, unreadConversations: unreadConv };
}
