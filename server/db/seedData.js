import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';
import { createRequest, decideRequest, receiveRequest } from '../src/services/purchaseRequests.js';
import { createBatch, completeBatch } from '../src/services/batches.js';

export const DEMO_PASSWORD = 'Demo@123';

export const DEMO_USERS = [
  { name: 'Aarav Sharma', email: 'requester@factoryflow.dev', role: 'requester' },
  { name: 'Neha Verma', email: 'approver@factoryflow.dev', role: 'approver' },
  { name: 'Rohan Patel', email: 'store@factoryflow.dev', role: 'store' },
  { name: 'Admin User', email: 'admin@factoryflow.dev', role: 'admin' },
];

const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

// Inserts the four demo users and returns them keyed by role: { requester: {id,...}, ... }
export async function seedUsers(db = pool, password = DEMO_PASSWORD) {
  const hash = await bcrypt.hash(password, 10);
  const byRole = {};
  for (const u of DEMO_USERS) {
    const { rows } = await db.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *`,
      [u.name, u.email, hash, u.role]
    );
    byRole[u.role] = rows[0];
  }
  return byRole;
}

// Realistic (but fictional) data for a Pichia pastoris sweet-protein fermentation plant.
export async function seedDemo() {
  const users = await seedUsers();
  const ids = { req: users.requester.id, app: users.approver.id, store: users.store.id };

  const itemDefs = [
    ['Glucose', 'Carbon source', 'kg', 300],
    ['Glycerol', 'Carbon source', 'L', 100],
    ['Yeast Extract', 'Nitrogen source', 'kg', 60],
    ['Peptone', 'Nitrogen source', 'kg', 40],
    ['Ammonium Sulfate', 'Salts', 'kg', 50],
    ['Potassium Phosphate', 'Salts', 'kg', 25],
    ['Methanol', 'Induction', 'L', 150],
    ['Antifoam', 'Process aid', 'L', 20],
  ];
  const item = {};
  for (const [name, category, unit, reorder] of itemDefs) {
    const { rows } = await pool.query(
      'INSERT INTO items (name, category, unit, reorder_level) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, category, unit, reorder]
    );
    item[name] = rows[0];
  }

  // Each lot goes through the real workflow: request -> approve -> receive.
  const lotDefs = [
    ['Glucose', 800, 300, 'LOT-GLU-0001', 'BioSource Traders'],
    ['Glucose', 600, 400, 'LOT-GLU-0002', 'BioSource Traders'],
    ['Glycerol', 200, 250, 'LOT-GLY-0001', 'Sharma Chemicals'],
    ['Yeast Extract', 120, 20, 'LOT-YE-0001', 'Nutri Labs'],
    ['Peptone', 120, 200, 'LOT-PEP-0001', 'Nutri Labs'],
    ['Ammonium Sulfate', 30, 500, 'LOT-AS-0001', 'Sharma Chemicals'],
    ['Potassium Phosphate', 60, 365, 'LOT-KP-0001', 'Sharma Chemicals'],
    ['Methanol', 400, 25, 'LOT-MEOH-0001', 'Sharma Chemicals'],
    ['Methanol', 200, 180, 'LOT-MEOH-0002', 'Sharma Chemicals'],
    ['Antifoam', 15, 300, 'LOT-AF-0001', 'Nutri Labs'],
  ];
  for (const [name, qty, expDays, lotNo, supplier] of lotDefs) {
    const pr = await createRequest(ids.req, { item_id: item[name].id, quantity: qty, reason: 'Initial stock' });
    await decideRequest(ids.app, pr.id, { decision: 'approved', note: 'OK' });
    await receiveRequest(ids.store, pr.id, {
      quantity_received: qty,
      expiry_date: inDays(expDays),
      supplier,
      lot_number: lotNo,
    });
  }

  // Four batches: three completed, one still running.
  const batchDefs = [
    ['P. pastoris GS115 - Brazzein v1', { Glucose: 150, 'Yeast Extract': 20, Peptone: 10, 'Ammonium Sulfate': 5, Methanol: 60, Antifoam: 2 }, 3.8],
    ['P. pastoris X-33 - Thaumatin II', { Glucose: 180, 'Yeast Extract': 25, Peptone: 12, 'Ammonium Sulfate': 5, Methanol: 70, Antifoam: 2 }, 4.4],
    ['P. pastoris GS115 - Brazzein v1', { Glucose: 160, 'Yeast Extract': 22, Peptone: 10, 'Ammonium Sulfate': 5, Methanol: 65, Antifoam: 2 }, 3.1],
    ['P. pastoris X-33 - Thaumatin II', { Glucose: 170, 'Yeast Extract': 24, Peptone: 11, 'Ammonium Sulfate': 5, Methanol: 68, Antifoam: 2 }, null],
  ];
  let daysAgo = 24;
  for (const [strain, usage, yieldKg] of batchDefs) {
    const consumption = Object.entries(usage).map(([name, quantity]) => ({ item_id: item[name].id, quantity }));
    const { batch } = await createBatch(ids.store, { strain, consumption });
    if (yieldKg !== null) await completeBatch(ids.store, batch.id, { yield_kg: yieldKg });
    // Spread the demo batches over past weeks so the yield chart has a timeline.
    await pool.query(
      `UPDATE batches SET started_at = now() - ($2 || ' days')::interval,
                          ended_at = CASE WHEN ended_at IS NULL THEN NULL
                                          ELSE now() - ($2 || ' days')::interval + interval '6 days' END
        WHERE id = $1`,
      [batch.id, String(daysAgo)]
    );
    daysAgo -= 7;
  }

  // Requests in the other states, so every screen has something to show.
  await createRequest(ids.req, { item_id: item['Glucose'].id, quantity: 500, needed_by: inDays(10), reason: 'Stock for the next two batches' });
  await createRequest(ids.req, { item_id: item['Yeast Extract'].id, quantity: 100, needed_by: inDays(5), reason: 'Below reorder level' });
  await createRequest(ids.req, { item_id: item['Ammonium Sulfate'].id, quantity: 100, needed_by: inDays(14), reason: 'Below reorder level' });

  const approved = await createRequest(ids.req, { item_id: item['Antifoam'].id, quantity: 40, needed_by: inDays(3), reason: 'Running low' });
  await decideRequest(ids.app, approved.id, { decision: 'approved', note: 'Approved, order today' });

  const rejected = await createRequest(ids.req, { item_id: item['Peptone'].id, quantity: 500, reason: 'Bulk buy' });
  await decideRequest(ids.app, rejected.id, { decision: 'rejected', note: 'Far above 3-month need. Please resubmit for 100 kg.' });
}
