import { pool } from '../config/db.js';
import { hashToken, randomUrlToken } from '../utils/cryptoToken.js';

const PURPOSE_PASSWORD_RESET = 'password_reset';
const PURPOSE_EMAIL_VERIFY = 'email_verify';

export async function createToken(userId, purpose, ttlHours = 24) {
  const raw = randomUrlToken(32);
  const tokenHash = hashToken(raw);
  const expires = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  await pool.query(`DELETE FROM auth_tokens WHERE user_id = $1 AND purpose = $2`, [userId, purpose]);
  await pool.query(
    `INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
    [userId, purpose, tokenHash, expires.toISOString()]
  );
  return raw;
}

export async function consumeToken(raw, purpose) {
  if (!raw) return null;
  const tokenHash = hashToken(raw);
  const r = await pool.query(
    `DELETE FROM auth_tokens WHERE token_hash = $1 AND purpose = $2 AND expires_at > NOW()
     RETURNING user_id`,
    [tokenHash, purpose]
  );
  return r.rows[0]?.user_id || null;
}

export async function findValidTokenUser(raw, purpose) {
  if (!raw) return null;
  const tokenHash = hashToken(raw);
  const r = await pool.query(
    `SELECT user_id FROM auth_tokens WHERE token_hash = $1 AND purpose = $2 AND expires_at > NOW()`,
    [tokenHash, purpose]
  );
  return r.rows[0]?.user_id || null;
}

export { PURPOSE_PASSWORD_RESET, PURPOSE_EMAIL_VERIFY };
