import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { audit } from '../audit.js';

const router = Router();
router.use(requireRole()); // admin only (admin is always allowed, nobody else is listed)

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, role, created_at FROM users ORDER BY id'
  );
  res.json(rows);
});

const createSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['requester', 'approver', 'store', 'admin']),
});

router.post('/', validate({ body: createSchema }), async (req, res) => {
  const { name, email, password, role } = req.valid.body;
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role, created_at`,
    [name, email.toLowerCase(), hash, role]
  );
  await audit(pool, req.user.id, 'user.created', 'user', rows[0].id, { role });
  res.status(201).json(rows[0]);
});

export default router;
