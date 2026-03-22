import { pool } from '../config/db.js';

/** One-time / idempotent data fixes after schema.sql */
export async function runDataMigrations() {
  await pool.query(`
    INSERT INTO conversation_members (conversation_id, user_id)
    SELECT c.id, c.participant_low
    FROM conversations c
    WHERE c.participant_low IS NOT NULL
    ON CONFLICT DO NOTHING
  `);
  await pool.query(`
    INSERT INTO conversation_members (conversation_id, user_id)
    SELECT c.id, c.participant_high
    FROM conversations c
    WHERE c.participant_high IS NOT NULL
    ON CONFLICT DO NOTHING
  `);

  await pool.query(`
    INSERT INTO message_attachments (message_id, url, mime)
    SELECT m.id, m.attachment_url, m.attachment_mime
    FROM messages m
    WHERE m.attachment_url IS NOT NULL AND m.attachment_url <> ''
      AND NOT EXISTS (SELECT 1 FROM message_attachments a WHERE a.message_id = m.id)
  `);
}
