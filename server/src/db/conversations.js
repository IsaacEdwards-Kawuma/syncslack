import { pool } from '../config/db.js';

export async function findConversationById(id) {
  const r = await pool.query(`SELECT * FROM conversations WHERE id = $1`, [id]);
  return r.rows[0] || null;
}

export async function findConversationByPair(workspaceId, userA, userB) {
  const r = await pool.query(
    `SELECT * FROM conversations
     WHERE workspace_id = $1
       AND participant_low = LEAST($2::uuid, $3::uuid)
       AND participant_high = GREATEST($2::uuid, $3::uuid)`,
    [workspaceId, userA, userB]
  );
  return r.rows[0] || null;
}

export async function createConversation(workspaceId, userA, userB) {
  const r = await pool.query(
    `INSERT INTO conversations (workspace_id, participant_low, participant_high)
     VALUES ($1, LEAST($2::uuid, $3::uuid), GREATEST($2::uuid, $3::uuid))
     ON CONFLICT (workspace_id, participant_low, participant_high) DO NOTHING
     RETURNING *`,
    [workspaceId, userA, userB]
  );
  if (r.rows[0]) return r.rows[0];
  return findConversationByPair(workspaceId, userA, userB);
}

export async function listConversationsForUser(workspaceId, userId) {
  const r = await pool.query(
    `SELECT * FROM conversations
     WHERE workspace_id = $1
       AND (participant_low = $2::uuid OR participant_high = $2::uuid)
     ORDER BY updated_at DESC`,
    [workspaceId, userId]
  );
  return r.rows;
}

export function getOtherParticipantId(conv, myUserId) {
  const uid = String(myUserId);
  if (String(conv.participant_low) === uid) return String(conv.participant_high);
  return String(conv.participant_low);
}

export async function touchConversationUpdatedAt(conversationId) {
  await pool.query(`UPDATE conversations SET updated_at = NOW() WHERE id = $1`, [conversationId]);
}
