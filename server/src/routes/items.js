import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { audit } from '../audit.js';

const router = Router();

// All items with their current usable stock (expired lots are not counted).
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT i.*,
            COALESCE(SUM(l.quantity_remaining)
              FILTER (WHERE l.expiry_date IS NULL OR l.expiry_date >= CURRENT_DATE), 0) AS stock
       FROM items i LEFT JOIN lots l ON l.item_id = i.id
      GROUP BY i.id ORDER BY i.name`
  );
  res.json(rows);
});

const createSchema = z.object({
  name: z.string().trim().min(2),
  category: z.string().trim().min(1).default('General'),
  unit: z.enum(['kg', 'g', 'L', 'mL', 'units']),
  reorder_level: z.coerce.number().min(0).default(0),
});

router.post('/', requireRole('store'), validate({ body: createSchema }), async (req, res) => {
  const { name, category, unit, reorder_level } = req.valid.body;
  const { rows } = await pool.query(
    `INSERT INTO items (name, category, unit, reorder_level) VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, category, unit, reorder_level]
  );
  await audit(pool, req.user.id, 'item.created', 'item', rows[0].id, { name });
  res.status(201).json(rows[0]);
});

export default router;
