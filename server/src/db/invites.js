import { pool } from '../config/db.js';
import { randomUrlToken } from '../utils/cryptoToken.js';

export async function createInvite({ workspaceId, invitedBy, role, ttlDays = 7 }) {
  const token = randomUrlToken(24);
  const expires = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  const r = await pool.query(
    `INSERT INTO workspace_invites (workspace_id, token, role, invited_by, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, workspace_id, token, role, invited_by, expires_at, created_at`,
    [workspaceId, token, role, invitedBy, expires.toISOString()]
  );
  return r.rows[0];
}

export async function findValidInviteByToken(token) {
  if (!token) return null;
  const r = await pool.query(
    `SELECT * FROM workspace_invites WHERE token = $1 AND expires_at > NOW()`,
    [token]
  );
  return r.rows[0] || null;
}
