import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { HttpError } from '../errors.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const LOT_SELECT = `
  SELECT l.*, i.name AS item_name, i.unit
    FROM lots l JOIN items i ON i.id = l.item_id`;

// Query: ?item_id=3  and/or  ?in_stock=true
router.get(
  '/',
  validate({
    query: z.object({
      item_id: z.coerce.number().int().positive().optional(),
      in_stock: z.enum(['true', 'false']).optional(),
    }),
  }),
  async (req, res) => {
    const where = [];
    const params = [];
    if (req.valid.query.item_id) {
      params.push(req.valid.query.item_id);
      where.push(`l.item_id = $${params.length}`);
    }
    if (req.valid.query.in_stock === 'true') where.push('l.quantity_remaining > 0');
    const { rows } = await pool.query(
      `${LOT_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY l.expiry_date NULLS LAST, l.id`,
      params
    );
    res.json(rows);
  }
);

// TRACEABILITY: give a lot number, get every batch that consumed it.
router.get('/:lotNumber/trace', async (req, res) => {
  const { rows: lots } = await pool.query(`${LOT_SELECT} WHERE l.lot_number = $1`, [
    req.params.lotNumber,
  ]);
  if (!lots[0]) throw new HttpError(404, 'Lot not found');

  const { rows: batches } = await pool.query(
    `SELECT b.id, b.batch_code, b.strain, b.status, b.started_at, b.ended_at, b.yield_kg,
            bl.quantity_used
       FROM batch_lots bl JOIN batches b ON b.id = bl.batch_id
      WHERE bl.lot_id = $1
      ORDER BY b.started_at`,
    [lots[0].id]
  );
  res.json({ lot: lots[0], batches });
});

export default router;
