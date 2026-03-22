import { pool } from '../config/db.js';

export function mapUserPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url || '',
    theme: row.theme || 'light',
    createdAt: row.created_at,
    emailVerified: Boolean(row.email_verified_at),
    statusText: row.status_text ?? '',
    statusEmoji: row.status_emoji ?? '',
  };
}

export async function findUserByEmail(email) {
  const r = await pool.query(
    `SELECT id, email, password_hash, name, avatar_url, theme, email_verified_at, status_text, status_emoji, created_at, updated_at
     FROM users WHERE email = $1`,
    [String(email).toLowerCase().trim()]
  );
  return r.rows[0] || null;
}

export async function findUserById(id) {
  const r = await pool.query(
    `SELECT id, email, password_hash, name, avatar_url, theme, email_verified_at, status_text, status_emoji, created_at, updated_at
     FROM users WHERE id = $1`,
    [id]
  );
  return r.rows[0] || null;
}

export async function createUser({ email, passwordHash, name, emailVerified = true }) {
  const r = await pool.query(
    `INSERT INTO users (email, password_hash, name, email_verified_at)
     VALUES ($1, $2, $3, CASE WHEN $4 THEN NOW() ELSE NULL END)
     RETURNING id, email, name, avatar_url, theme, email_verified_at, status_text, status_emoji, created_at, updated_at`,
    [email.toLowerCase(), passwordHash, name.trim(), emailVerified]
  );
  return r.rows[0];
}

export async function updateTheme(userId, theme) {
  const r = await pool.query(
    `UPDATE users SET theme = $2, updated_at = NOW() WHERE id = $1
     RETURNING id, email, name, avatar_url, theme, email_verified_at, status_text, status_emoji, created_at, updated_at`,
    [userId, theme]
  );
  return r.rows[0] || null;
}

export async function updateStatus(userId, statusText, statusEmoji) {
  const r = await pool.query(
    `UPDATE users SET status_text = $2, status_emoji = $3, updated_at = NOW() WHERE id = $1
     RETURNING id, email, name, avatar_url, theme, email_verified_at, status_text, status_emoji, created_at, updated_at`,
    [userId, String(statusText ?? '').slice(0, 140), String(statusEmoji ?? '').slice(0, 32)]
  );
  return r.rows[0] || null;
}

export async function updateAvatarUrl(userId, avatarUrl) {
  const r = await pool.query(
    `UPDATE users SET avatar_url = $2, updated_at = NOW() WHERE id = $1
     RETURNING id, email, name, avatar_url, theme, email_verified_at, status_text, status_emoji, created_at, updated_at`,
    [userId, String(avatarUrl || '').slice(0, 500)]
  );
  return r.rows[0] || null;
}

export async function updatePasswordHash(userId, passwordHash) {
  await pool.query(`UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`, [
    userId,
    passwordHash,
  ]);
}

export async function setEmailVerifiedNow(userId) {
  await pool.query(`UPDATE users SET email_verified_at = NOW(), updated_at = NOW() WHERE id = $1`, [userId]);
}

export async function findUsersByIds(ids) {
  if (!ids.length) return [];
  const r = await pool.query(
    `SELECT id, name, email, avatar_url FROM users WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  return r.rows;
}
