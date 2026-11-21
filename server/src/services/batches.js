import { withTransaction } from '../db.js';
import { HttpError } from '../errors.js';
import { audit } from '../audit.js';

const yyyymmdd = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

// Create a fermentation batch and consume raw materials using FEFO
// (First-Expiry-First-Out): lots that expire soonest are used first.
// Everything runs in ONE transaction: if any item is short, no stock is touched.
export function createBatch(userId, { strain, notes, consumption }) {
  return withTransaction(async (db) => {
    // Always process items in the same order, so two concurrent batches
    // lock rows in the same order and can't deadlock each other.
    const wanted = [...consumption].sort((a, b) => a.item_id - b.item_id);

    const { rows: seq } = await db.query("SELECT nextval('batch_seq') AS n");
    const batchCode = `B-${yyyymmdd()}-${String(seq[0].n).padStart(3, '0')}`;
    const { rows: batchRows } = await db.query(
      `INSERT INTO batches (batch_code, strain, notes, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [batchCode, strain, notes ?? null, userId]
    );
    const batch = batchRows[0];
    const allocations = [];

    for (const { item_id, quantity } of wanted) {
      const { rows: itemRows } = await db.query('SELECT id, name, unit FROM items WHERE id = $1', [
        item_id,
      ]);
      const item = itemRows[0];
      if (!item) throw new HttpError(404, `Item ${item_id} not found`);

      // Usable lots only: not expired, still has stock. Locked while we work.
      const { rows: lots } = await db.query(
        `SELECT id, lot_number, quantity_remaining
           FROM lots
          WHERE item_id = $1
            AND quantity_remaining > 0
            AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
          ORDER BY expiry_date ASC NULLS LAST, received_at ASC, id ASC
            FOR UPDATE`,
        [item_id]
      );

      const available = lots.reduce((sum, l) => sum + l.quantity_remaining, 0);
      if (available < quantity) {
        throw new HttpError(
          409,
          `Not enough ${item.name}: need ${quantity} ${item.unit}, only ${available} ${item.unit} usable`,
          { item_id, requested: quantity, available }
        );
      }

      let left = quantity;
      for (const lot of lots) {
        if (left <= 0) break;
        const take = Math.min(lot.quantity_remaining, left);
        await db.query('UPDATE lots SET quantity_remaining = quantity_remaining - $2 WHERE id = $1', [
          lot.id,
          take,
        ]);
        await db.query(
          'INSERT INTO batch_lots (batch_id, lot_id, quantity_used) VALUES ($1, $2, $3)',
          [batch.id, lot.id, take]
        );
        allocations.push({
          item_id,
          item_name: item.name,
          unit: item.unit,
          lot_number: lot.lot_number,
          quantity_used: take,
        });
        left -= take;
      }
    }

    await audit(db, userId, 'batch.created', 'batch', batch.id, { batch_code: batchCode, strain });
    return { batch, allocations };
  });
}

export function completeBatch(userId, batchId, { yield_kg }) {
  return withTransaction(async (db) => {
    const { rows } = await db.query('SELECT * FROM batches WHERE id = $1 FOR UPDATE', [batchId]);
    if (!rows[0]) throw new HttpError(404, 'Batch not found');
    if (rows[0].status !== 'running') throw new HttpError(409, 'Batch is already completed');
    const { rows: updated } = await db.query(
      `UPDATE batches SET status = 'completed', ended_at = now(), yield_kg = $2
        WHERE id = $1 RETURNING *`,
      [batchId, yield_kg]
    );
    await audit(db, userId, 'batch.completed', 'batch', batchId, { yield_kg });
    return updated[0];
  });
}
