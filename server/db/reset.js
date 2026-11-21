import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from '../src/db.js';
import { seedDemo, DEMO_PASSWORD, DEMO_USERS } from './seedData.js';

const schema = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'schema.sql'), 'utf8');

console.log('Recreating tables...');
await pool.query(schema);
console.log('Seeding demo data...');
await seedDemo();
await pool.end();

console.log('\nDone. Demo logins (password for all: ' + DEMO_PASSWORD + '):');
for (const u of DEMO_USERS) console.log(`  ${u.role.padEnd(10)} ${u.email}`);
