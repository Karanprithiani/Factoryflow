import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { HttpError } from '../errors.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createBatch, completeBatch } from '../services/batches.js';

const router = Router();
const idParam = z.object({ id: z.coerce.number().int().positive() });

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT b.*, u.name AS created_by_name,
            (SELECT COUNT(*) FROM batch_lots bl WHERE bl.batch_id = b.id)::int AS lots_used
       FROM batches b JOIN users u ON u.id = b.created_by
      ORDER BY b.started_at DESC, b.id DESC`
  );
  res.json(rows);
});

// Batch detail + reverse traceability: which lots went into this batch.
router.get('/:id', validate({ params: idParam }), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM batches WHERE id = $1', [req.valid.params.id]);
  if (!rows[0]) throw new HttpError(404, 'Batch not found');
  const { rows: lots } = await pool.query(
    `SELECT l.lot_number, i.name AS item_name, i.unit, l.supplier, l.expiry_date, bl.quantity_used
       FROM batch_lots bl
       JOIN lots l ON l.id = bl.lot_id
       JOIN items i ON i.id = l.item_id
      WHERE bl.batch_id = $1
      ORDER BY i.name, l.expiry_date`,
    [req.valid.params.id]
  );
  res.json({ batch: rows[0], lots });
});

const createSchema = z.object({
  strain: z.string().trim().min(2).max(120),
  notes: z.string().trim().max(500).optional(),
  consumption: z
    .array(
      z.object({
        item_id: z.coerce.number().int().positive(),
        quantity: z.coerce.number().positive(),
      })
    )
    .min(1, 'A batch needs at least one raw material')
    .refine((c) => new Set(c.map((x) => x.item_id)).size === c.length, 'List each item only once'),
});

router.post('/', requireRole('store'), validate({ body: createSchema }), async (req, res) => {
  res.status(201).json(await createBatch(req.user.id, req.valid.body));
});

router.post(
  '/:id/complete',
  requireRole('store'),
  validate({ params: idParam, body: z.object({ yield_kg: z.coerce.number().min(0) }) }),
  async (req, res) => {
    res.json(await completeBatch(req.user.id, req.valid.params.id, req.valid.body));
  }
);

export default router;
