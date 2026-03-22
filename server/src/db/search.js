import { pool } from '../config/db.js';

export async function searchWorkspaceMessages(workspaceId, userId, query, limit = 40) {
  const safe = String(query).trim().slice(0, 200).replace(/%/g, '').replace(/_/g, '');
  if (!safe) return [];
  const q = `%${safe}%`;

  const channelSql = `
    SELECT m.id, m.content, m.created_at, m.channel_id AS channel_id, NULL::uuid AS conversation_id,
           ch.name AS channel_name, NULL::text AS conv_label
    FROM messages m
    JOIN channels ch ON ch.id = m.channel_id
    WHERE ch.workspace_id = $1::uuid
      AND m.deleted_at IS NULL
      AND m.thread_parent_id IS NULL
      AND m.content ILIKE $2
      AND (
        ch.type = 'public'
        OR EXISTS (
          SELECT 1 FROM channel_members cm WHERE cm.channel_id = ch.id AND cm.user_id = $3::uuid
        )
      )
  `;

  const convSql = `
    SELECT m.id, m.content, m.created_at, NULL::uuid AS channel_id, m.conversation_id,
           NULL::text AS channel_name,
           COALESCE(c.title, '') AS conv_label
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    INNER JOIN conversation_members mem ON mem.conversation_id = c.id AND mem.user_id = $3::uuid
    WHERE c.workspace_id = $1::uuid
      AND m.deleted_at IS NULL
      AND m.content ILIKE $2
  `;

  const r = await pool.query(
    `(${channelSql}) UNION ALL (${convSql})
     ORDER BY created_at DESC
     LIMIT $4`,
    [workspaceId, q, userId, limit]
  );

  return r.rows.map((row) => ({
    id: row.id,
    content: row.content,
    createdAt: row.created_at,
    channelId: row.channel_id,
    conversationId: row.conversation_id,
    channelName: row.channel_name,
    conversationLabel: row.conv_label,
  }));
}
