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
  };
}

export async function findUserByEmail(email) {
  const r = await pool.query(
    `SELECT id, email, password_hash, name, avatar_url, theme, created_at, updated_at
     FROM users WHERE email = $1`,
    [String(email).toLowerCase().trim()]
  );
  return r.rows[0] || null;
}

export async function findUserById(id) {
  const r = await pool.query(
    `SELECT id, email, password_hash, name, avatar_url, theme, created_at, updated_at
     FROM users WHERE id = $1`,
    [id]
  );
  return r.rows[0] || null;
}

export async function createUser({ email, passwordHash, name }) {
  const r = await pool.query(
    `INSERT INTO users (email, password_hash, name)
     VALUES ($1, $2, $3)
     RETURNING id, email, name, avatar_url, theme, created_at, updated_at`,
    [email.toLowerCase(), passwordHash, name.trim()]
  );
  return r.rows[0];
}

export async function updateTheme(userId, theme) {
  const r = await pool.query(
    `UPDATE users SET theme = $2, updated_at = NOW() WHERE id = $1
     RETURNING id, email, name, avatar_url, theme, created_at, updated_at`,
    [userId, theme]
  );
  return r.rows[0] || null;
}

export async function findUsersByIds(ids) {
  if (!ids.length) return [];
  const r = await pool.query(
    `SELECT id, name, email, avatar_url FROM users WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  return r.rows;
}
