import { pool } from '../config/db.js';

export async function workspaceExistsBySlug(slug) {
  const r = await pool.query(`SELECT 1 FROM workspaces WHERE slug = $1`, [slug]);
  return r.rowCount > 0;
}

export async function findWorkspaceById(id) {
  const r = await pool.query(
    `SELECT w.*, u.id AS owner_user_id, u.name AS owner_name, u.email AS owner_email, u.avatar_url AS owner_avatar_url
     FROM workspaces w
     JOIN users u ON u.id = w.owner_id
     WHERE w.id = $1`,
    [id]
  );
  return r.rows[0] || null;
}

export async function findWorkspaceBySlug(slug) {
  const r = await pool.query(
    `SELECT w.*, u.id AS owner_user_id, u.name AS owner_name, u.email AS owner_email, u.avatar_url AS owner_avatar_url
     FROM workspaces w
     JOIN users u ON u.id = w.owner_id
     WHERE w.slug = $1`,
    [slug.trim().toLowerCase()]
  );
  return r.rows[0] || null;
}

export async function listMembers(workspaceId) {
  const r = await pool.query(
    `SELECT wm.user_id, wm.role, u.name, u.email, u.avatar_url
     FROM workspace_members wm
     JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_id = $1`,
    [workspaceId]
  );
  return r.rows;
}

export async function listWorkspacesForUser(userId) {
  const r = await pool.query(
    `SELECT w.*, u.id AS owner_user_id, u.name AS owner_name, u.email AS owner_email, u.avatar_url AS owner_avatar_url
     FROM workspaces w
     JOIN workspace_members wm ON wm.workspace_id = w.id
     JOIN users u ON u.id = w.owner_id
     WHERE wm.user_id = $1
     ORDER BY w.updated_at DESC`,
    [userId]
  );
  return r.rows;
}

export function isMemberRow(membersRows, userId) {
  return membersRows.some((m) => m.user_id === userId);
}

export async function isMember(workspaceId, userId) {
  const r = await pool.query(
    `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId]
  );
  return r.rowCount > 0;
}

export async function createWorkspaceWithGeneral({ name, description, slug, ownerId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ws = await client.query(
      `INSERT INTO workspaces (name, slug, description, owner_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, slug, description, owner_id, created_at, updated_at`,
      [name.trim(), slug, description || '', ownerId]
    );
    const wid = ws.rows[0].id;
    await client.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [wid, ownerId]
    );
    await client.query(
      `INSERT INTO channels (workspace_id, name, type, description, created_by)
       VALUES ($1, 'general', 'public', '', $2)`,
      [wid, ownerId]
    );
    await client.query('COMMIT');
    return ws.rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function addMember(workspaceId, userId, role = 'member') {
  await pool.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (workspace_id, user_id) DO NOTHING`,
    [workspaceId, userId, role]
  );
}

export function formatWorkspace(row, membersRows) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    owner: row.owner_user_id
      ? {
          id: row.owner_user_id,
          name: row.owner_name,
          email: row.owner_email,
          avatarUrl: row.owner_avatar_url,
        }
      : null,
    members: (membersRows || []).map((m) => ({
      userId: m.user_id,
      role: m.role,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
