import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from '../errors.js';

// Reads "Authorization: Bearer <token>", verifies it, and sets req.user.
export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Missing authentication token');
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { id: Number(payload.sub), role: payload.role, name: payload.name };
    next();
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }
}

// Role-based access control. Admin is always allowed.
//   router.post('/', requireRole('requester'), handler)
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (req.user.role === 'admin' || roles.includes(req.user.role)) return next();
    throw new HttpError(403, 'Your role is not allowed to do this');
  };
