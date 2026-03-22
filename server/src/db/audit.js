import { pool } from '../config/db.js';

export async function logAction({ workspaceId, actorId, action, meta }) {
  await pool.query(
    `INSERT INTO audit_log (workspace_id, actor_id, action, meta) VALUES ($1, $2, $3, $4::jsonb)`,
    [workspaceId || null, actorId, action, JSON.stringify(meta || {})]
  );
}

export async function listForWorkspace(workspaceId, limit = 100) {
  const r = await pool.query(
    `SELECT id, workspace_id, actor_id, action, meta, created_at
     FROM audit_log WHERE workspace_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [workspaceId, limit]
  );
  return r.rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    actorId: row.actor_id,
    action: row.action,
    meta: row.meta,
    createdAt: row.created_at,
  }));
}
