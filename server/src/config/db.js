import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Assigned in connectDB() so DATABASE_URL is read after dotenv (see server startup order). */
export let pool = null;

export async function connectDB() {
  const conn = process.env.DATABASE_URL?.trim();
  if (!conn) {
    throw new Error('DATABASE_URL is not set');
  }
  const useSsl = !conn.includes('localhost') && !conn.includes('127.0.0.1');
  pool = new pg.Pool({
    connectionString: conn,
    max: 15,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  const schemaPath = path.join(__dirname, '../db/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
  const r = await pool.query('SELECT 1 AS ok');
  if (!r.rows[0]) throw new Error('PostgreSQL ping failed');
  console.log('PostgreSQL connected (schema applied)');
}
