import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app, request, resetDb, login, as, pool, daysFromNow } from './helpers.js';

describe('purchase request workflow', () => {
  let items, requester, approver, store, admin;

  beforeAll(async () => {
    ({ items } = await resetDb());
    [requester, approver, store, admin] = await Promise.all(
      ['requester', 'approver', 'store', 'admin'].map(login)
    );
  });
  afterAll(() => pool.end());

  const create = (token = requester, body = {}) =>
    request(app)
      .post('/api/purchase-requests')
      .set(as(token))
      .send({ item_id: items['Glucose'], quantity: 50, ...body });

  it('runs the full path: request -> approve -> receive creates a lot', async () => {
    const created = await create();
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('pending');
    const id = created.body.id;

    const approved = await request(app)
      .post(`/api/purchase-requests/${id}/decision`)
      .set(as(approver))
      .send({ decision: 'approved' });
    expect(approved.body.status).toBe('approved');

    const received = await request(app)
      .post(`/api/purchase-requests/${id}/receive`)
      .set(as(store))
      .send({ quantity_received: 50, expiry_date: daysFromNow(100), supplier: 'Test Supplier' });
    expect(received.status).toBe(201);
    expect(received.body.request.status).toBe('received');
    expect(received.body.lot.quantity_remaining).toBe(50);

    // The audit trail recorded all three steps.
    const { rows } = await pool.query(
      `SELECT action FROM audit_log WHERE entity = 'purchase_request' AND entity_id = $1 ORDER BY id`,
      [id]
    );
    expect(rows.map((r) => r.action)).toEqual([
      'purchase_request.created',
      'purchase_request.approved',
      'purchase_request.received',
    ]);
  });

  it('does not let a requester approve, or a store create requests', async () => {
    const { body } = await create();
    const approve = await request(app)
      .post(`/api/purchase-requests/${body.id}/decision`)
      .set(as(requester))
      .send({ decision: 'approved' });
    expect(approve.status).toBe(403);
    expect((await create(store)).status).toBe(403);
  });

  it('blocks invalid status changes (approve twice, receive before approval)', async () => {
    const { body } = await create();
    const decide = () =>
      request(app)
        .post(`/api/purchase-requests/${body.id}/decision`)
        .set(as(approver))
        .send({ decision: 'approved' });
    expect((await decide()).status).toBe(200);
    expect((await decide()).status).toBe(409);

    const fresh = (await create()).body;
    const early = await request(app)
      .post(`/api/purchase-requests/${fresh.id}/receive`)
      .set(as(store))
      .send({ quantity_received: 10 });
    expect(early.status).toBe(409);
  });

  it('prevents approving your own request (segregation of duties)', async () => {
    const { body } = await create(admin); // admin creates it...
    const res = await request(app)
      .post(`/api/purchase-requests/${body.id}/decision`)
      .set(as(admin)) // ...and tries to approve it
      .send({ decision: 'approved' });
    expect(res.status).toBe(403);
  });

  it('requires a note when rejecting and validates input', async () => {
    const { body } = await create();
    const noNote = await request(app)
      .post(`/api/purchase-requests/${body.id}/decision`)
      .set(as(approver))
      .send({ decision: 'rejected' });
    expect(noNote.status).toBe(400);
    expect((await create(requester, { quantity: -5 })).status).toBe(400);
    expect((await create(requester, { item_id: 9999 })).status).toBe(404);
  });

  it('shows requesters only their own requests', async () => {
    const mine = await request(app).get('/api/purchase-requests').set(as(requester));
    const all = await request(app).get('/api/purchase-requests').set(as(approver));
    expect(all.body.length).toBeGreaterThanOrEqual(mine.body.length);
    const requesterId = (await request(app).get('/api/auth/me').set(as(requester))).body.id;
    expect(mine.body.every((r) => r.requested_by === requesterId)).toBe(true);
  });
});
