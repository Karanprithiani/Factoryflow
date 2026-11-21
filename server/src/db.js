import pg from 'pg';
import { config } from './config.js';

// Postgres NUMERIC comes back as a string by default; we want numbers.
pg.types.setTypeParser(1700, (v) => parseFloat(v));
// Keep DATE columns as 'YYYY-MM-DD' strings so time zones never shift a date.
pg.types.setTypeParser(1082, (v) => v);

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.pgSsl ? { rejectUnauthorized: false } : undefined,
});

// Run `fn(client)` inside one transaction. Commits on success, rolls back on any error.
// This is what keeps stock deduction atomic: either everything happens, or nothing does.
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
