import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { app, request, resetDb, login, as, pool, addLot, daysFromNow } from './helpers.js';

describe('batches, FEFO allocation and traceability', () => {
  let items, users, store;

  beforeAll(async () => {
    ({ items, users } = await resetDb());
    store = await login('store');
  });
  beforeEach(async () => {
    await pool.query('TRUNCATE batch_lots, batches, lots RESTART IDENTITY CASCADE');
  });
  afterAll(() => pool.end());

  const lot = (lotNumber, qty, expiryDays, item = 'Glucose') =>
    addLot({ itemId: items[item], qty, expiry: daysFromNow(expiryDays), lotNumber, storeUserId: users.store.id });

  const makeBatch = (consumption, token = store) =>
    request(app).post('/api/batches').set(as(token)).send({ strain: 'Test Strain', consumption });

  const stock = async (lotNumber) =>
    (await pool.query('SELECT quantity_remaining FROM lots WHERE lot_number = $1', [lotNumber])).rows[0]
      .quantity_remaining;

  it('uses the lot that expires first (FEFO), spilling into the next lot', async () => {
    await lot('LATE', 100, 90);
    await lot('SOON', 40, 10); // expires first, so it must be used first
    const res = await makeBatch([{ item_id: items['Glucose'], quantity: 60 }]);
    expect(res.status).toBe(201);
    expect(res.body.allocations).toEqual([
      expect.objectContaining({ lot_number: 'SOON', quantity_used: 40 }),
      expect.objectContaining({ lot_number: 'LATE', quantity_used: 20 }),
    ]);
    expect(await stock('SOON')).toBe(0);
    expect(await stock('LATE')).toBe(80);
  });

  it('never uses an expired lot', async () => {
    await lot('EXPIRED', 100, -5);
    await lot('GOOD', 30, 60);
    const tooMuch = await makeBatch([{ item_id: items['Glucose'], quantity: 50 }]);
    expect(tooMuch.status).toBe(409); // only 30 usable, the expired 100 does not count
    const ok = await makeBatch([{ item_id: items['Glucose'], quantity: 30 }]);
    expect(ok.status).toBe(201);
    expect(await stock('EXPIRED')).toBe(100);
  });

  it('is atomic: if one item is short, no stock is deducted at all', async () => {
    await lot('GLU-1', 100, 60);
    await lot('YE-1', 5, 60, 'Yeast Extract');
    const res = await makeBatch([
      { item_id: items['Glucose'], quantity: 50 }, // would succeed...
      { item_id: items['Yeast Extract'], quantity: 10 }, // ...but this one is short
    ]);
    expect(res.status).toBe(409);
    expect(await stock('GLU-1')).toBe(100); // untouched
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM batches')).rows[0].n).toBe(0);
  });

  it('is safe under concurrency: two batches racing for the same stock, only one wins', async () => {
    await lot('RACE', 100, 60);
    const [a, b] = await Promise.all([
      makeBatch([{ item_id: items['Glucose'], quantity: 60 }]),
      makeBatch([{ item_id: items['Glucose'], quantity: 60 }]),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await stock('RACE')).toBe(40); // never negative, never double-spent
  });

  it('traces a lot forward to batches and a batch back to lots', async () => {
    await lot('TRACE-1', 100, 60);
    const made = await makeBatch([{ item_id: items['Glucose'], quantity: 25 }]);
    const trace = await request(app).get('/api/lots/TRACE-1/trace').set(as(store));
    expect(trace.status).toBe(200);
    expect(trace.body.batches).toHaveLength(1);
    expect(trace.body.batches[0]).toMatchObject({ batch_code: made.body.batch.batch_code, quantity_used: 25 });

    const detail = await request(app).get(`/api/batches/${made.body.batch.id}`).set(as(store));
    expect(detail.body.lots[0]).toMatchObject({ lot_number: 'TRACE-1', quantity_used: 25 });
    expect((await request(app).get('/api/lots/NOPE/trace').set(as(store))).status).toBe(404);
  });

  it('completes a batch once and records the yield', async () => {
    await lot('Y-1', 100, 60);
    const made = await makeBatch([{ item_id: items['Glucose'], quantity: 10 }]);
    const url = `/api/batches/${made.body.batch.id}/complete`;
    const done = await request(app).post(url).set(as(store)).send({ yield_kg: 3.5 });
    expect(done.body).toMatchObject({ status: 'completed', yield_kg: 3.5 });
    expect((await request(app).post(url).set(as(store)).send({ yield_kg: 1 })).status).toBe(409);
  });

  it('only store/admin can create batches', async () => {
    await lot('R-1', 100, 60);
    const requester = await login('requester');
    expect((await makeBatch([{ item_id: items['Glucose'], quantity: 1 }], requester)).status).toBe(403);
  });
});
