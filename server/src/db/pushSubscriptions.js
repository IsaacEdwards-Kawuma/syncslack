import { pool } from '../config/db.js';

export async function upsertSubscription(userId, endpoint, keys) {
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, keys)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (user_id, endpoint) DO UPDATE SET keys = EXCLUDED.keys`,
    [userId, endpoint, JSON.stringify(keys || {})]
  );
}

export async function listEndpointsForUser(userId) {
  const r = await pool.query(`SELECT endpoint, keys FROM push_subscriptions WHERE user_id = $1`, [userId]);
  return r.rows;
}
