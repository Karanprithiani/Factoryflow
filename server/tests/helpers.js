import { readFileSync } from 'node:fs';
import request from 'supertest';
import { pool } from '../src/db.js';
import { createApp } from '../src/app.js';
import { seedUsers, DEMO_PASSWORD } from '../db/seedData.js';

// SAFETY GUARD: Tests drop and recreate all tables. We refuse to run if the
// database name does not contain "test" — this protects the real database from
// accidental deletion during development.
const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
if (!dbUrl.toLowerCase().includes('test')) {
  throw new Error(
    `\n\n🚨 REFUSING TO RUN TESTS\n` +
    `The database URL "${dbUrl}" does not contain the word "test".\n` +
    `Set TEST_DATABASE_URL to a separate test database (e.g. factoryflow_test).\n` +
    `Running tests on a production database will DELETE ALL DATA.\n`
  );
}

export const app = createApp();
const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');

// Fresh empty database + the four users + a few items, before every test file.
export async function resetDb() {
  await pool.query(schema);
  const users = await seedUsers();
  const { rows } = await pool.query(
    `INSERT INTO items (name, unit, reorder_level) VALUES
       ('Glucose', 'kg', 100), ('Yeast Extract', 'kg', 20) RETURNING id, name`
  );
  return { users, items: Object.fromEntries(rows.map((r) => [r.name, r.id])) };
}

export async function login(role) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: `${role}@factoryflow.dev`, password: DEMO_PASSWORD });
  return res.body.token;
}

export const as = (token) => ({ Authorization: `Bearer ${token}` });

export async function addLot({ itemId, qty, expiry, lotNumber, storeUserId }) {
  const { rows } = await pool.query(
    `INSERT INTO lots (lot_number, item_id, quantity_received, quantity_remaining, expiry_date, received_by)
     VALUES ($1, $2, $3, $3, $4, $5) RETURNING *`,
    [lotNumber, itemId, qty, expiry, storeUserId]
  );
  return rows[0];
}

export const daysFromNow = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
export { request, pool };
