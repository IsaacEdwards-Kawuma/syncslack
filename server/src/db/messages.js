import { pool } from '../config/db.js';
import { touchConversationUpdatedAt } from './conversations.js';

function mapSender(u) {
  if (!u?.id) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatar_url || '',
  };
}

function normalizeReactions(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((r) => ({
    emoji: r.emoji,
    userIds: (r.userIds || r.users || []).map((id) => String(id)),
  }));
}

export function formatMessageRow(m, senderRow) {
  return {
    id: m.id,
    senderId: m.sender_id,
    sender: mapSender(senderRow),
    channelId: m.channel_id || null,
    conversationId: m.conversation_id || null,
    content: m.content,
    createdAt: m.created_at,
    editedAt: m.edited_at,
    deletedAt: m.deleted_at,
    threadParentId: m.thread_parent_id || null,
    alsoToChannel: Boolean(m.also_to_channel),
    reactions: normalizeReactions(m.reactions),
    attachmentUrl: m.attachment_url || '',
    attachmentMime: m.attachment_mime || '',
    attachments: [],
  };
}

function rowToMessageAndSender(row) {
  const senderRow = {
    id: row.sender_id,
    name: row.sender_name,
    email: row.sender_email,
    avatar_url: row.sender_avatar_url,
  };
  const m = { ...row };
  delete m.sender_name;
  delete m.sender_email;
  delete m.sender_avatar_url;
  return { m, senderRow };
}

async function fetchAttachmentsMap(messageIds) {
  if (!messageIds.length) return new Map();
  const r = await pool.query(
    `SELECT id, message_id, url, mime, original_name
     FROM message_attachments
     WHERE message_id = ANY($1::uuid[])
     ORDER BY created_at ASC`,
    [messageIds]
  );
  const map = new Map();
  for (const row of r.rows) {
    const list = map.get(row.message_id) || [];
    list.push({ id: row.id, url: row.url, mime: row.mime, originalName: row.original_name });
    map.set(row.message_id, list);
  }
  return map;
}

function mergeAttachments(msg, attMap) {
  const fromTable = attMap.get(msg.id) || [];
  const legacy =
    msg.attachmentUrl && !fromTable.length
      ? [{ id: null, url: msg.attachmentUrl, mime: msg.attachmentMime || '' }]
      : [];
  msg.attachments = fromTable.length ? fromTable : legacy;
  if (msg.attachments.length) {
    msg.attachmentUrl = msg.attachments[0].url;
    msg.attachmentMime = msg.attachments[0].mime;
  }
  return msg;
}

async function enrichList(msgs) {
  const ids = msgs.map((m) => m.id);
  const attMap = await fetchAttachmentsMap(ids);
  return msgs.map((m) => mergeAttachments(m, attMap));
}

export async function findMessageById(id) {
  const r = await pool.query(
    `SELECT m.*, u.name AS sender_name, u.email AS sender_email, u.avatar_url AS sender_avatar_url
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.id = $1`,
    [id]
  );
  if (!r.rows[0]) return null;
  const { m, senderRow } = rowToMessageAndSender(r.rows[0]);
  const msg = formatMessageRow(m, senderRow);
  const attMap = await fetchAttachmentsMap([id]);
  return mergeAttachments(msg, attMap);
}

export async function listChannelRootMessages(channelId, before, limit) {
  let beforeTs = null;
  let beforeId = null;
  if (before) {
    const cur = await pool.query(`SELECT created_at, id FROM messages WHERE id = $1`, [before]);
    if (cur.rows[0]) {
      beforeTs = cur.rows[0].created_at;
      beforeId = cur.rows[0].id;
    }
  }
  const r = await pool.query(
    `SELECT m.*, u.name AS sender_name, u.email AS sender_email, u.avatar_url AS sender_avatar_url
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.channel_id = $1
       AND m.conversation_id IS NULL
       AND m.thread_parent_id IS NULL
       AND m.deleted_at IS NULL
       AND ($3::timestamptz IS NULL OR (m.created_at, m.id) < ($3::timestamptz, $4::uuid))
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT $2`,
    [channelId, limit, beforeTs, beforeId]
  );
  const list = r.rows
    .map((row) => {
      const { m, senderRow } = rowToMessageAndSender(row);
      return formatMessageRow(m, senderRow);
    })
    .reverse();
  return enrichList(list);
}

export async function listChannelRootMessagesAround(channelId, messageId, limit = 60) {
  const l = Math.max(10, Math.min(200, parseInt(limit, 10) || 60));
  const beforeLimit = Math.floor((l - 1) / 2);
  const afterLimit = l - 1 - beforeLimit;

  const cur = await pool.query(
    `SELECT m.*, u.name AS sender_name, u.email AS sender_email, u.avatar_url AS sender_avatar_url
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.channel_id = $1
       AND m.conversation_id IS NULL
       AND m.thread_parent_id IS NULL
       AND m.deleted_at IS NULL
       AND m.id = $2`,
    [channelId, messageId]
  );
  if (!cur.rows[0]) return [];

  const curRow = cur.rows[0];
  const curCreatedAt = curRow.created_at;
  const curId = curRow.id;
  const { m: curMsg, senderRow: curSender } = rowToMessageAndSender(curRow);
  const current = formatMessageRow(curMsg, curSender);

  const rBefore = await pool.query(
    `SELECT m.*, u.name AS sender_name, u.email AS sender_email, u.avatar_url AS sender_avatar_url
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.channel_id = $1
       AND m.conversation_id IS NULL
       AND m.thread_parent_id IS NULL
       AND m.deleted_at IS NULL
       AND (m.created_at, m.id) < ($2::timestamptz, $3::uuid)
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT $4`,
    [channelId, curCreatedAt, curId, beforeLimit]
  );

  const rAfter = await pool.query(
    `SELECT m.*, u.name AS sender_name, u.email AS sender_email, u.avatar_url AS sender_avatar_url
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.channel_id = $1
       AND m.conversation_id IS NULL
       AND m.thread_parent_id IS NULL
       AND m.deleted_at IS NULL
       AND (m.created_at, m.id) > ($2::timestamptz, $3::uuid)
     ORDER BY m.created_at ASC, m.id ASC
     LIMIT $4`,
    [channelId, curCreatedAt, curId, afterLimit]
  );

  const beforeList = rBefore.rows
    .map((row) => {
      const { m, senderRow } = rowToMessageAndSender(row);
      return formatMessageRow(m, senderRow);
    })
    .reverse();

  const afterList = rAfter.rows.map((row) => {
    const { m, senderRow } = rowToMessageAndSender(row);
    return formatMessageRow(m, senderRow);
  });

  return enrichList([...beforeList, current, ...afterList]);
}

export async function listThreadReplies(parentId) {
  const r = await pool.query(
    `SELECT m.*, u.name AS sender_name, u.email AS sender_email, u.avatar_url AS sender_avatar_url
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.thread_parent_id = $1 AND m.deleted_at IS NULL
     ORDER BY m.created_at ASC, m.id ASC`,
    [parentId]
  );
  const list = r.rows.map((row) => {
    const { m, senderRow } = rowToMessageAndSender(row);
    return formatMessageRow(m, senderRow);
  });
  return enrichList(list);
}

export async function listConversationMessages(conversationId, before, limit) {
  let beforeTs = null;
  let beforeId = null;
  if (before) {
    const cur = await pool.query(`SELECT created_at, id FROM messages WHERE id = $1`, [before]);
    if (cur.rows[0]) {
      beforeTs = cur.rows[0].created_at;
      beforeId = cur.rows[0].id;
    }
  }
  const r = await pool.query(
    `SELECT m.*, u.name AS sender_name, u.email AS sender_email, u.avatar_url AS sender_avatar_url
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = $1
       AND m.channel_id IS NULL
       AND m.thread_parent_id IS NULL
       AND m.deleted_at IS NULL
       AND ($3::timestamptz IS NULL OR (m.created_at, m.id) < ($3::timestamptz, $4::uuid))
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT $2`,
    [conversationId, limit, beforeTs, beforeId]
  );
  const list = r.rows
    .map((row) => {
      const { m, senderRow } = rowToMessageAndSender(row);
      return formatMessageRow(m, senderRow);
    })
    .reverse();
  return enrichList(list);
}

export async function listConversationMessagesAround(conversationId, messageId, limit = 60) {
  const l = Math.max(10, Math.min(200, parseInt(limit, 10) || 60));
  const beforeLimit = Math.floor((l - 1) / 2);
  const afterLimit = l - 1 - beforeLimit;

  const cur = await pool.query(
    `SELECT m.*, u.name AS sender_name, u.email AS sender_email, u.avatar_url AS sender_avatar_url
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = $1
       AND m.channel_id IS NULL
       AND m.thread_parent_id IS NULL
       AND m.deleted_at IS NULL
       AND m.id = $2`,
    [conversationId, messageId]
  );
  if (!cur.rows[0]) return [];

  const curRow = cur.rows[0];
  const curCreatedAt = curRow.created_at;
  const curId = curRow.id;
  const { m: curMsg, senderRow: curSender } = rowToMessageAndSender(curRow);
  const current = formatMessageRow(curMsg, curSender);

  const rBefore = await pool.query(
    `SELECT m.*, u.name AS sender_name, u.email AS sender_email, u.avatar_url AS sender_avatar_url
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = $1
       AND m.channel_id IS NULL
       AND m.thread_parent_id IS NULL
       AND m.deleted_at IS NULL
       AND (m.created_at, m.id) < ($2::timestamptz, $3::uuid)
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT $4`,
    [conversationId, curCreatedAt, curId, beforeLimit]
  );

  const rAfter = await pool.query(
    `SELECT m.*, u.name AS sender_name, u.email AS sender_email, u.avatar_url AS sender_avatar_url
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = $1
       AND m.channel_id IS NULL
       AND m.thread_parent_id IS NULL
       AND m.deleted_at IS NULL
       AND (m.created_at, m.id) > ($2::timestamptz, $3::uuid)
     ORDER BY m.created_at ASC, m.id ASC
     LIMIT $4`,
    [conversationId, curCreatedAt, curId, afterLimit]
  );

  const beforeList = rBefore.rows
    .map((row) => {
      const { m, senderRow } = rowToMessageAndSender(row);
      return formatMessageRow(m, senderRow);
    })
    .reverse();

  const afterList = rAfter.rows.map((row) => {
    const { m, senderRow } = rowToMessageAndSender(row);
    return formatMessageRow(m, senderRow);
  });

  return enrichList([...beforeList, current, ...afterList]);
}

async function insertAttachments(messageId, attachments) {
  if (!attachments?.length) return;
  for (const a of attachments) {
    if (!a?.url) continue;
    await pool.query(
      `INSERT INTO message_attachments (message_id, url, mime, original_name)
       VALUES ($1, $2, $3, $4)`,
      [messageId, a.url, a.mime || '', a.originalName || '']
    );
  }
}

export async function createChannelMessage({
  senderId,
  channelId,
  content,
  threadParentId,
  attachmentUrl,
  attachmentMime,
  attachments,
  alsoToChannel = false,
}) {
  const attList =
    attachments && attachments.length
      ? attachments
      : attachmentUrl
        ? [{ url: attachmentUrl, mime: attachmentMime || '', originalName: '' }]
        : [];
  const first = attList[0] || {};
  const r = await pool.query(
    `INSERT INTO messages (sender_id, channel_id, conversation_id, thread_parent_id, content, attachment_url, attachment_mime, also_to_channel)
     VALUES ($1, $2, NULL, $3, $4, $5, $6, $7)
     RETURNING *`,
    [senderId, channelId, threadParentId || null, content, first.url || '', first.mime || '', !!alsoToChannel]
  );
  const id = r.rows[0].id;
  await insertAttachments(id, attList);
  return findMessageById(id);
}

export async function createConversationMessage({
  senderId,
  conversationId,
  content,
  threadParentId,
  attachmentUrl,
  attachmentMime,
  attachments,
}) {
  const attList =
    attachments && attachments.length
      ? attachments
      : attachmentUrl
        ? [{ url: attachmentUrl, mime: attachmentMime || '', originalName: '' }]
        : [];
  const first = attList[0] || {};
  const r = await pool.query(
    `INSERT INTO messages (sender_id, channel_id, conversation_id, thread_parent_id, content, attachment_url, attachment_mime, also_to_channel)
     VALUES ($1, NULL, $2, $3, $4, $5, $6, FALSE)
     RETURNING *`,
    [senderId, conversationId, threadParentId || null, content, first.url || '', first.mime || '']
  );
  const id = r.rows[0].id;
  await insertAttachments(id, attList);
  await touchConversationUpdatedAt(conversationId);
  return findMessageById(id);
}

export async function replaceMentions(messageId, mentionedUserIds) {
  await pool.query(`DELETE FROM message_mentions WHERE message_id = $1`, [messageId]);
  for (const uid of mentionedUserIds) {
    await pool.query(
      `INSERT INTO message_mentions (message_id, mentioned_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [messageId, uid]
    );
  }
}

export async function lastMessagePreview(conversationId) {
  const r = await pool.query(
    `SELECT content, created_at FROM messages
     WHERE conversation_id = $1 AND deleted_at IS NULL
     ORDER BY created_at DESC, id DESC LIMIT 1`,
    [conversationId]
  );
  return r.rows[0] || null;
}

export async function updateMessageContent(messageId, content) {
  await pool.query(
    `UPDATE messages SET content = $2, edited_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [messageId, content]
  );
  return findMessageById(messageId);
}

export async function softDeleteMessage(messageId) {
  await pool.query(
    `UPDATE messages SET content = '[deleted]', deleted_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [messageId]
  );
  return findMessageById(messageId);
}

export async function toggleReactionOnMessage(messageId, userId, emoji) {
  const r = await pool.query(`SELECT reactions FROM messages WHERE id = $1`, [messageId]);
  if (!r.rows[0]) return null;
  let reactions = r.rows[0].reactions;
  if (typeof reactions === 'string') reactions = JSON.parse(reactions);
  if (!Array.isArray(reactions)) reactions = [];
  const uid = String(userId);
  let bucket = reactions.find((x) => x.emoji === emoji);
  if (!bucket) {
    bucket = { emoji, userIds: [] };
    reactions.push(bucket);
  }
  const list = bucket.userIds || bucket.users || [];
  const idx = list.findIndex((x) => String(x) === uid);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(uid);
  bucket.userIds = list;
  delete bucket.users;
  reactions = reactions.filter((b) => (b.userIds || []).length > 0);
  await pool.query(`UPDATE messages SET reactions = $2::jsonb, updated_at = NOW() WHERE id = $1`, [
    messageId,
    JSON.stringify(reactions),
  ]);
  return findMessageById(messageId);
}
