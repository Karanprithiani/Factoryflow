import { pool, withTransaction } from '../db.js';
import { HttpError } from '../errors.js';
import { audit } from '../audit.js';

const yyyymmdd = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

export async function createRequest(userId, { item_id, quantity, needed_by, reason }) {
  const { rows: items } = await pool.query('SELECT id FROM items WHERE id = $1', [item_id]);
  if (!items.length) throw new HttpError(404, 'Item not found');

  const { rows } = await pool.query(
    `INSERT INTO purchase_requests (item_id, quantity, needed_by, reason, requested_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [item_id, quantity, needed_by ?? null, reason ?? null, userId]
  );
  await audit(pool, userId, 'purchase_request.created', 'purchase_request', rows[0].id, {
    item_id,
    quantity,
  });
  return rows[0];
}

// Approver approves or rejects a pending request.
export function decideRequest(userId, requestId, { decision, note }) {
  return withTransaction(async (db) => {
    // FOR UPDATE locks the row, so two approvers can't decide the same request at once.
    const { rows } = await db.query('SELECT * FROM purchase_requests WHERE id = $1 FOR UPDATE', [
      requestId,
    ]);
    const pr = rows[0];
    if (!pr) throw new HttpError(404, 'Purchase request not found');
    // Segregation of duties: nobody approves their own request.
    if (pr.requested_by === userId) {
      throw new HttpError(403, 'You cannot approve or reject your own request');
    }
    if (pr.status !== 'pending') {
      throw new HttpError(409, `Request is already ${pr.status}`);
    }
    const { rows: updated } = await db.query(
      `UPDATE purchase_requests
          SET status = $2, decided_by = $3, decided_at = now(), decision_note = $4
        WHERE id = $1 RETURNING *`,
      [requestId, decision, userId, note ?? null]
    );
    await audit(db, userId, `purchase_request.${decision}`, 'purchase_request', requestId, { note });
    return updated[0];
  });
}

// Store receives the goods: the request becomes "received" and a new lot is created.
export function receiveRequest(userId, requestId, { quantity_received, expiry_date, supplier, lot_number }) {
  return withTransaction(async (db) => {
    const { rows } = await db.query('SELECT * FROM purchase_requests WHERE id = $1 FOR UPDATE', [
      requestId,
    ]);
    const pr = rows[0];
    if (!pr) throw new HttpError(404, 'Purchase request not found');
    if (pr.status !== 'approved') {
      throw new HttpError(409, `Only approved requests can be received (this one is ${pr.status})`);
    }

    const finalLotNumber = lot_number || `LOT-${yyyymmdd()}-PR${pr.id}`;
    const { rows: lots } = await db.query(
      `INSERT INTO lots (lot_number, item_id, purchase_request_id, supplier,
                         quantity_received, quantity_remaining, expiry_date, received_by)
       VALUES ($1, $2, $3, $4, $5, $5, $6, $7) RETURNING *`,
      [finalLotNumber, pr.item_id, pr.id, supplier ?? null, quantity_received, expiry_date ?? null, userId]
    );
    const { rows: updated } = await db.query(
      `UPDATE purchase_requests
          SET status = 'received', received_by = $2, received_at = now()
        WHERE id = $1 RETURNING *`,
      [requestId, userId]
    );
    await audit(db, userId, 'purchase_request.received', 'purchase_request', requestId, {
      lot_number: finalLotNumber,
      quantity_received,
    });
    return { request: updated[0], lot: lots[0] };
  });
}
