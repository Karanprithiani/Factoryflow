import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app, request, resetDb, login, as, pool, addLot, daysFromNow } from './helpers.js';
import { runDailyChecks } from '../src/jobs/dailyChecks.js';

describe('dashboard and daily checks', () => {
  let items, users, token;

  beforeAll(async () => {
    ({ items, users } = await resetDb());
    token = await login('approver');
    // Glucose: 30 kg usable (reorder level 100 => LOW). Yeast Extract: 500 kg but expiring in 5 days.
    await addLot({ itemId: items['Glucose'], qty: 30, expiry: daysFromNow(200), lotNumber: 'G-1', storeUserId: users.store.id });
    await addLot({ itemId: items['Yeast Extract'], qty: 500, expiry: daysFromNow(5), lotNumber: 'YE-SOON', storeUserId: users.store.id });
  });
  afterAll(() => pool.end());

  it('reports low stock, expiring lots and pending approvals', async () => {
    await pool.query(
      `INSERT INTO purchase_requests (item_id, quantity, requested_by) VALUES ($1, 10, $2)`,
      [items['Glucose'], users.requester.id]
    );
    const res = await request(app).get('/api/dashboard').set(as(token));
    expect(res.status).toBe(200);
    expect(res.body.low_stock.map((i) => i.name)).toContain('Glucose');
    expect(res.body.expiring_soon.map((l) => l.lot_number)).toEqual(['YE-SOON']);
    expect(res.body.pending_approvals).toBe(1);
  });

  it('daily job writes alerts once per day, even if it runs twice', async () => {
    const first = await runDailyChecks();
    await runDailyChecks();
    expect(first.lowStock).toBeGreaterThanOrEqual(1);
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM alerts');
    expect(rows[0].n).toBe(first.lowStock + first.expiring);
  });
});
