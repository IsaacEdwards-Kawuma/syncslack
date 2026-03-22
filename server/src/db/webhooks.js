import { pool } from '../config/db.js';
import crypto from 'crypto';

export async function create({ workspaceId, channelId, name, createdBy }) {
  const secretToken = crypto.randomBytes(24).toString('hex');
  const r = await pool.query(
    `INSERT INTO incoming_webhooks (workspace_id, channel_id, secret_token, name, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, workspace_id, channel_id, secret_token, name, created_at`,
    [workspaceId, channelId, secretToken, (name || 'Incoming webhook').slice(0, 120), createdBy]
  );
  return r.rows[0];
}

export async function findByToken(secretToken) {
  const r = await pool.query(
    `SELECT id, workspace_id, channel_id, secret_token, name, created_by FROM incoming_webhooks WHERE secret_token = $1`,
    [secretToken]
  );
  return r.rows[0] || null;
}

export async function listForChannel(channelId) {
  const r = await pool.query(
    `SELECT id, name, secret_token, created_at FROM incoming_webhooks WHERE channel_id = $1 ORDER BY created_at DESC`,
    [channelId]
  );
  return r.rows;
}

export async function deleteWebhook(id, userId) {
  const r = await pool.query(`DELETE FROM incoming_webhooks WHERE id = $1 AND created_by = $2 RETURNING id`, [
    id,
    userId,
  ]);
  return r.rowCount > 0;
}
