import { pool } from '../config/db.js';

export async function findChannelById(id) {
  const r = await pool.query(`SELECT * FROM channels WHERE id = $1`, [id]);
  return r.rows[0] || null;
}

export async function listChannelsByWorkspace(workspaceId) {
  const r = await pool.query(
    `SELECT * FROM channels WHERE workspace_id = $1 ORDER BY name ASC`,
    [workspaceId]
  );
  return r.rows;
}

export async function listChannelMemberIds(channelId) {
  const r = await pool.query(`SELECT user_id FROM channel_members WHERE channel_id = $1`, [channelId]);
  return r.rows.map((x) => x.user_id);
}

export async function createChannel({ workspaceId, name, type, description, createdBy, memberIds }) {
  const r = await pool.query(
    `INSERT INTO channels (workspace_id, name, type, description, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [workspaceId, name, type, description || '', createdBy]
  );
  const ch = r.rows[0];
  for (const uid of memberIds || []) {
    await pool.query(
      `INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [ch.id, uid]
    );
  }
  return ch;
}

export async function addChannelMember(channelId, userId) {
  await pool.query(
    `INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [channelId, userId]
  );
}

export async function removeChannelMember(channelId, userId) {
  await pool.query(`DELETE FROM channel_members WHERE channel_id = $1 AND user_id = $2`, [channelId, userId]);
}

export async function loadChannelsWithMembers(workspaceId) {
  const channels = await listChannelsByWorkspace(workspaceId);
  const out = [];
  for (const ch of channels) {
    const memberIds = await listChannelMemberIds(ch.id);
    out.push({ ...ch, member_ids: memberIds });
  }
  return out;
}

export function formatChannel(row) {
  const mids = row.member_ids || [];
  return {
    id: row.id,
    name: row.name,
    workspaceId: row.workspace_id,
    type: row.type,
    description: row.description,
    memberIds: mids,
    createdAt: row.created_at,
  };
}
