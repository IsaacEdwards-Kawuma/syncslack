import { pool } from '../config/db.js';
import { isValidUuid } from '../utils/ids.js';

/**
 * @param {string} workspaceId
 * @param {string} userId
 * @param {string} query
 * @param {number} limit
 * @param {object} [options]
 * @param {string|null} [options.fromUserId]
 * @param {string|null} [options.channelId] — search only this channel (no DMs)
 * @param {string|null} [options.conversationId] — search only this DM/group
 * @param {string|null} [options.dateFrom] — ISO date
 * @param {string|null} [options.dateTo] — ISO date (inclusive end of day)
 * @param {boolean} [options.searchInFiles=true] — also match attachment URLs / filenames
 */
export async function searchWorkspaceMessages(workspaceId, userId, query, limit = 40, options = {}) {
  const safe = String(query).trim().slice(0, 200).replace(/%/g, '').replace(/_/g, '');
  if (!safe) return [];
  const q = `%${safe}%`;

  const fromUserId =
    options.fromUserId && isValidUuid(String(options.fromUserId)) ? String(options.fromUserId) : null;
  const scopeChannelId =
    options.channelId && isValidUuid(String(options.channelId)) ? String(options.channelId) : null;
  const scopeConversationId =
    options.conversationId && isValidUuid(String(options.conversationId))
      ? String(options.conversationId)
      : null;
  const searchInFiles = options.searchInFiles !== false;

  let dateFrom = options.dateFrom ? new Date(options.dateFrom) : null;
  let dateTo = options.dateTo ? new Date(options.dateTo) : null;
  if (dateFrom && isNaN(dateFrom.getTime())) dateFrom = null;
  if (dateTo && isNaN(dateTo.getTime())) dateTo = null;
  if (dateTo) {
    dateTo = new Date(dateTo);
    dateTo.setHours(23, 59, 59, 999);
  }

  const contentMatch = searchInFiles
    ? `(m.content ILIKE $2 OR EXISTS (SELECT 1 FROM message_attachments ma WHERE ma.message_id = m.id AND ma.url ILIKE $2))`
    : `m.content ILIKE $2`;

  const params = [workspaceId, q, userId];
  let idx = 4;
  let filterSql = '';

  if (fromUserId) {
    filterSql += ` AND m.sender_id = $${idx}::uuid`;
    params.push(fromUserId);
    idx += 1;
  }
  if (dateFrom) {
    filterSql += ` AND m.created_at >= $${idx}::timestamptz`;
    params.push(dateFrom.toISOString());
    idx += 1;
  }
  if (dateTo) {
    filterSql += ` AND m.created_at <= $${idx}::timestamptz`;
    params.push(dateTo.toISOString());
    idx += 1;
  }

  let channelSql;
  let convSql;

  if (scopeConversationId) {
    channelSql = `SELECT m.id, m.content, m.created_at, NULL::uuid AS channel_id, NULL::uuid AS conversation_id,
           NULL::text AS channel_name, NULL::text AS conv_label FROM messages m WHERE false`;
    convSql = `
    SELECT m.id, m.content, m.created_at, NULL::uuid AS channel_id, m.conversation_id,
           NULL::text AS channel_name,
           COALESCE(c.title, '') AS conv_label
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    INNER JOIN conversation_members mem ON mem.conversation_id = c.id AND mem.user_id = $3::uuid
    WHERE c.workspace_id = $1::uuid
      AND c.id = $${idx}::uuid
      AND m.deleted_at IS NULL
      AND ${contentMatch}
      ${filterSql}
  `;
    params.push(scopeConversationId);
    idx += 1;
  } else if (scopeChannelId) {
    convSql = `SELECT m.id, m.content, m.created_at, NULL::uuid AS channel_id, NULL::uuid AS conversation_id,
           NULL::text AS channel_name, NULL::text AS conv_label FROM messages m WHERE false`;
    channelSql = `
    SELECT m.id, m.content, m.created_at, m.channel_id AS channel_id, NULL::uuid AS conversation_id,
           ch.name AS channel_name, NULL::text AS conv_label
    FROM messages m
    JOIN channels ch ON ch.id = m.channel_id
    WHERE ch.workspace_id = $1::uuid
      AND ch.id = $${idx}::uuid
      AND m.deleted_at IS NULL
      AND m.thread_parent_id IS NULL
      AND ${contentMatch}
      ${filterSql}
      AND (
        ch.type = 'public'
        OR EXISTS (
          SELECT 1 FROM channel_members cm WHERE cm.channel_id = ch.id AND cm.user_id = $3::uuid
        )
      )
  `;
    params.push(scopeChannelId);
    idx += 1;
  } else {
    channelSql = `
    SELECT m.id, m.content, m.created_at, m.channel_id AS channel_id, NULL::uuid AS conversation_id,
           ch.name AS channel_name, NULL::text AS conv_label
    FROM messages m
    JOIN channels ch ON ch.id = m.channel_id
    WHERE ch.workspace_id = $1::uuid
      AND m.deleted_at IS NULL
      AND m.thread_parent_id IS NULL
      AND ${contentMatch}
      ${filterSql}
      AND (
        ch.type = 'public'
        OR EXISTS (
          SELECT 1 FROM channel_members cm WHERE cm.channel_id = ch.id AND cm.user_id = $3::uuid
        )
      )
  `;
    convSql = `
    SELECT m.id, m.content, m.created_at, NULL::uuid AS channel_id, m.conversation_id,
           NULL::text AS channel_name,
           COALESCE(c.title, '') AS conv_label
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    INNER JOIN conversation_members mem ON mem.conversation_id = c.id AND mem.user_id = $3::uuid
    WHERE c.workspace_id = $1::uuid
      AND m.deleted_at IS NULL
      AND ${contentMatch}
      ${filterSql}
  `;
  }

  params.push(limit);
  const limitParamIndex = idx;

  const r = await pool.query(
    `(${channelSql}) UNION ALL (${convSql})
     ORDER BY created_at DESC
     LIMIT $${limitParamIndex}`,
    params
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

function safeLike(q) {
  return String(q).trim().slice(0, 100).replace(/%/g, '').replace(/_/g, '');
}

export async function searchWorkspaceChannels(workspaceId, userId, query, limit = 20) {
  const safe = safeLike(query);
  if (!safe) return [];
  const pattern = `%${safe}%`;
  const r = await pool.query(
    `SELECT c.id, c.name, c.type
     FROM channels c
     WHERE c.workspace_id = $1::uuid
       AND c.name ILIKE $2
       AND (
         c.type = 'public'
         OR EXISTS (SELECT 1 FROM channel_members cm WHERE cm.channel_id = c.id AND cm.user_id = $3::uuid)
       )
     ORDER BY c.name ASC
     LIMIT $4`,
    [workspaceId, pattern, userId, limit]
  );
  return r.rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
  }));
}

export async function searchWorkspacePeople(workspaceId, query, limit = 20) {
  const safe = safeLike(query);
  if (!safe) return [];
  const pattern = `%${safe}%`;
  const r = await pool.query(
    `SELECT u.id, u.name, u.email, u.avatar_url
     FROM users u
     INNER JOIN workspace_members wm ON wm.user_id = u.id AND wm.workspace_id = $1::uuid
     WHERE (u.name ILIKE $2 OR u.email ILIKE $2)
     ORDER BY u.name ASC
     LIMIT $3`,
    [workspaceId, pattern, limit]
  );
  return r.rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatar_url || '',
  }));
}
