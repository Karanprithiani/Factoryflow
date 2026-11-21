import { ZodError } from 'zod';
import { HttpError } from '../errors.js';

export function notFound(req, res) {
  res.status(404).json({ error: 'Route not found' });
}

// One place that turns every kind of error into a clean JSON response.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  if (err.code === '23505') return res.status(409).json({ error: 'That value already exists' });
  if (err.code === '23514') return res.status(409).json({ error: 'Value violates a database rule' });
  console.error(err); // real bugs: log them, but never leak internals to the client
  res.status(500).json({ error: 'Something went wrong on the server' });
}
