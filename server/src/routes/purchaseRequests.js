import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { HttpError } from '../errors.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createRequest, decideRequest, receiveRequest } from '../services/purchaseRequests.js';

const router = Router();

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const idParam = z.object({ id: z.coerce.number().int().positive() });

const SELECT = `
  SELECT pr.*, i.name AS item_name, i.unit,
         u.name AS requested_by_name, d.name AS decided_by_name
    FROM purchase_requests pr
    JOIN items i ON i.id = pr.item_id
    JOIN users u ON u.id = pr.requested_by
    LEFT JOIN users d ON d.id = pr.decided_by`;

// Requesters only see their own requests; approver / store / admin see everything.
router.get(
  '/',
  validate({ query: z.object({ status: z.enum(['pending', 'approved', 'rejected', 'received']).optional() }) }),
  async (req, res) => {
    const where = [];
    const params = [];
    if (req.user.role === 'requester') {
      params.push(req.user.id);
      where.push(`pr.requested_by = $${params.length}`);
    }
    if (req.valid.query.status) {
      params.push(req.valid.query.status);
      where.push(`pr.status = $${params.length}`);
    }
    const sql = `${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY pr.created_at DESC, pr.id DESC`;
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  }
);

router.get('/:id', validate({ params: idParam }), async (req, res) => {
  const { rows } = await pool.query(`${SELECT} WHERE pr.id = $1`, [req.valid.params.id]);
  const pr = rows[0];
  // Requesters get a 404 (not 403) for other people's requests, so ids can't be probed.
  if (!pr || (req.user.role === 'requester' && pr.requested_by !== req.user.id)) {
    throw new HttpError(404, 'Purchase request not found');
  }
  res.json(pr);
});

const createSchema = z.object({
  item_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  needed_by: dateString.optional(),
  reason: z.string().trim().max(500).optional(),
});

router.post('/', requireRole('requester'), validate({ body: createSchema }), async (req, res) => {
  res.status(201).json(await createRequest(req.user.id, req.valid.body));
});

const decisionSchema = z
  .object({ decision: z.enum(['approved', 'rejected']), note: z.string().trim().max(500).optional() })
  .refine((d) => d.decision === 'approved' || (d.note && d.note.length > 0), {
    message: 'A note is required when rejecting',
    path: ['note'],
  });

router.post(
  '/:id/decision',
  requireRole('approver'),
  validate({ params: idParam, body: decisionSchema }),
  async (req, res) => {
    res.json(await decideRequest(req.user.id, req.valid.params.id, req.valid.body));
  }
);

const receiveSchema = z.object({
  quantity_received: z.coerce.number().positive(),
  expiry_date: dateString
    .refine((d) => d >= new Date().toISOString().slice(0, 10), 'Expiry date cannot be in the past')
    .optional(),
  supplier: z.string().trim().max(200).optional(),
  lot_number: z.string().trim().min(3).max(60).optional(),
});

router.post(
  '/:id/receive',
  requireRole('store'),
  validate({ params: idParam, body: receiveSchema }),
  async (req, res) => {
    res.status(201).json(await receiveRequest(req.user.id, req.valid.params.id, req.valid.body));
  }
);

export default router;
