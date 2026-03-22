import { pool } from '../config/db.js';

export async function findConversationById(id) {
  const r = await pool.query(`SELECT * FROM conversations WHERE id = $1`, [id]);
  return r.rows[0] || null;
}

export async function findConversationByPair(workspaceId, userA, userB) {
  const r = await pool.query(
    `SELECT * FROM conversations
     WHERE workspace_id = $1 AND kind = 'direct'
       AND participant_low = LEAST($2::uuid, $3::uuid)
       AND participant_high = GREATEST($2::uuid, $3::uuid)`,
    [workspaceId, userA, userB]
  );
  return r.rows[0] || null;
}

async function ensureConversationMembers(conversationId, userIds) {
  for (const uid of userIds) {
    await pool.query(
      `INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [conversationId, uid]
    );
  }
}

export async function createConversation(workspaceId, userA, userB) {
  const existing = await findConversationByPair(workspaceId, userA, userB);
  if (existing) {
    await ensureConversationMembers(existing.id, [userA, userB]);
    return existing;
  }
  const r = await pool.query(
    `INSERT INTO conversations (workspace_id, kind, participant_low, participant_high, title)
     VALUES ($1, 'direct', LEAST($2::uuid, $3::uuid), GREATEST($2::uuid, $3::uuid), '')
     RETURNING *`,
    [workspaceId, userA, userB]
  );
  const conv = r.rows[0];
  await ensureConversationMembers(conv.id, [userA, userB]);
  return conv;
}

export async function createGroupConversation(workspaceId, creatorId, memberIds, title) {
  const ids = [...new Set([creatorId, ...memberIds])].filter(Boolean);
  if (ids.length < 2) throw new Error('Group needs at least 2 members');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ins = await client.query(
      `INSERT INTO conversations (workspace_id, kind, participant_low, participant_high, title)
       VALUES ($1, 'group', NULL, NULL, $2)
       RETURNING *`,
      [workspaceId, (title || '').trim() || 'Group']
    );
    const conv = ins.rows[0];
    for (const uid of ids) {
      await client.query(
        `INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2)`,
        [conv.id, uid]
      );
    }
    await client.query('COMMIT');
    return conv;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function listConversationMemberIds(conversationId) {
  const r = await pool.query(
    `SELECT user_id FROM conversation_members WHERE conversation_id = $1`,
    [conversationId]
  );
  return r.rows.map((x) => String(x.user_id));
}

export async function isConversationMember(conversationId, userId) {
  const r = await pool.query(
    `SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  return r.rowCount > 0;
}

export async function listConversationsForUser(workspaceId, userId) {
  const r = await pool.query(
    `SELECT c.* FROM conversations c
     INNER JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = $2::uuid
     WHERE c.workspace_id = $1
     ORDER BY c.updated_at DESC`,
    [workspaceId, userId]
  );
  return r.rows;
}

export function getOtherParticipantId(conv, myUserId) {
  if (conv.kind === 'group') return null;
  const uid = String(myUserId);
  if (String(conv.participant_low) === uid) return String(conv.participant_high);
  return String(conv.participant_low);
}

export async function addMembersToGroupConversation(conversationId, userIds) {
  const conv = await findConversationById(conversationId);
  if (!conv || conv.kind !== 'group') throw new Error('Not a group conversation');
  for (const uid of userIds) {
    await pool.query(
      `INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [conversationId, uid]
    );
  }
  await touchConversationUpdatedAt(conversationId);
}

export async function touchConversationUpdatedAt(conversationId) {
  await pool.query(`UPDATE conversations SET updated_at = NOW() WHERE id = $1`, [conversationId]);
}
