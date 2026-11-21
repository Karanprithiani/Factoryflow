import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { pool } from '../db.js';
import { config } from '../config.js';
import { HttpError } from '../errors.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// Slow down password-guessing attacks.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  skip: () => config.isTest,
  message: { error: 'Too many login attempts, try again later' },
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

router.post('/login', loginLimiter, validate({ body: loginSchema }), async (req, res) => {
  const { email, password } = req.valid.body;
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  const user = rows[0];
  // Same message for "no such user" and "wrong password" so attackers learn nothing.
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) throw new HttpError(401, 'Invalid email or password');

  const token = jwt.sign({ role: user.role, name: user.name }, config.jwtSecret, {
    subject: String(user.id),
    expiresIn: config.jwtExpiresIn,
  });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

router.get('/me', authenticate, async (req, res) => {
  const { rows } = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [
    req.user.id,
  ]);
  if (!rows[0]) throw new HttpError(401, 'User no longer exists');
  res.json(rows[0]);
});

export default router;
