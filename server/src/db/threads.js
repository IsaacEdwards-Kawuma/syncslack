import { pool } from '../config/db.js';
import { isValidUuid } from '../utils/ids.js';

export async function markThreadRead(userId, threadRootMessageId) {
  await pool.query(
    `INSERT INTO thread_reads (user_id, thread_root_message_id, last_read_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id, thread_root_message_id) DO UPDATE SET last_read_at = NOW()`,
    [userId, threadRootMessageId]
  );
}

export async function resolveThread(threadRootMessageId, resolvedBy) {
  await pool.query(
    `INSERT INTO thread_resolutions (thread_root_message_id, resolved_by, resolved_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (thread_root_message_id) DO UPDATE
       SET resolved_by = $2, resolved_at = NOW()`,
    [threadRootMessageId, resolvedBy]
  );
}

export async function unresolveThread(threadRootMessageId) {
  await pool.query(`DELETE FROM thread_resolutions WHERE thread_root_message_id = $1`, [threadRootMessageId]);
}

export async function listThreadInbox(workspaceId, userId, limit = 50) {
  const l = Math.min(parseInt(limit, 10) || 50, 100);
  const ws = String(workspaceId);
  const uid = String(userId);
  if (!isValidUuid(ws) || !isValidUuid(uid)) return { items: [], counts: { unread: 0, mentioned: 0 } };

  const { rows } = await pool.query(
    `
    WITH thread_roots AS (
      SELECT DISTINCT thread_parent_id AS root_id
      FROM messages
      WHERE thread_parent_id IS NOT NULL
        AND deleted_at IS NULL
    )
    SELECT
      m.id AS thread_root_id,
      m.content AS thread_root_content,
      m.created_at AS thread_root_created_at,
      m.sender_id AS sender_id,
      u.name AS sender_name,
      u.avatar_url AS sender_avatar_url,
      m.channel_id AS channel_id,
      m.conversation_id AS conversation_id,
      COALESCE(tr.last_read_at, 'epoch'::timestamptz) AS last_read_at,
      EXISTS (
        SELECT 1
        FROM messages r
        WHERE r.thread_parent_id = m.id
          AND r.deleted_at IS NULL
          AND r.created_at > COALESCE(tr.last_read_at, 'epoch'::timestamptz)
      ) AS is_unread,
      (m.sender_id = $2::uuid) AS is_participating,
      EXISTS (
        SELECT 1
        FROM messages r
        WHERE r.thread_parent_id = m.id
          AND r.deleted_at IS NULL
          AND r.sender_id = $2::uuid
      ) AS did_participate,
      EXISTS (
        SELECT 1
        FROM message_mentions mm
        JOIN messages mx ON mx.id = mm.message_id
        WHERE mm.user_id = $2::uuid
          AND (mm.message_id = m.id OR mx.thread_parent_id = m.id)
      ) AS is_mentioned,
      (trsl.thread_root_message_id IS NOT NULL) AS is_resolved
    FROM thread_roots trd
    JOIN messages m ON m.id = trd.root_id
    JOIN users u ON u.id = m.sender_id
    LEFT JOIN thread_reads tr
      ON tr.thread_root_message_id = m.id AND tr.user_id = $2::uuid
    LEFT JOIN thread_resolutions trsl
      ON trsl.thread_root_message_id = m.id
    WHERE m.deleted_at IS NULL
      AND (
        (
          m.channel_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM channels ch
            WHERE ch.id = m.channel_id
              AND ch.workspace_id = $1::uuid
              AND (
                ch.type = 'public'
                OR EXISTS (
                  SELECT 1 FROM channel_members cm
                  WHERE cm.channel_id = ch.id AND cm.user_id = $2::uuid
                )
              )
          )
        )
        OR (
          m.conversation_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM conversations c
            JOIN conversation_members mem
              ON mem.conversation_id = c.id AND mem.user_id = $2::uuid
            WHERE c.id = m.conversation_id AND c.workspace_id = $1::uuid
          )
        )
      )
    ORDER BY thread_root_created_at DESC
    LIMIT $3
    `,
    [ws, uid, l]
  );

  const items = rows.map((r) => ({
    id: r.thread_root_id,
    content: r.thread_root_content,
    createdAt: r.thread_root_created_at,
    senderId: r.sender_id,
    sender: { id: r.sender_id, name: r.sender_name, avatarUrl: r.sender_avatar_url || '' },
    channelId: r.channel_id,
    conversationId: r.conversation_id,
    unread: Boolean(r.is_unread),
    mentioned: Boolean(r.is_mentioned),
    participating: Boolean(r.is_participating || r.did_participate),
    resolved: Boolean(r.is_resolved),
  }));

  const counts = {
    unread: items.filter((x) => x.unread).length,
    mentioned: items.filter((x) => x.mentioned).length,
  };
  return { items, counts };
}

