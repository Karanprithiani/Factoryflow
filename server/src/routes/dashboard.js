import { Router } from 'express';
import { pool } from '../db.js';
import { LOW_STOCK_SQL, EXPIRING_SQL } from '../queries.js';

const router = Router();

router.get('/', async (req, res) => {
  const [low, expiring, byStatus, yields, alerts] = await Promise.all([
    pool.query(LOW_STOCK_SQL),
    pool.query(EXPIRING_SQL, [30]),
    pool.query(`SELECT status, COUNT(*)::int AS count FROM purchase_requests GROUP BY status`),
    pool.query(
      `SELECT batch_code, strain, yield_kg, ended_at
         FROM batches WHERE status = 'completed'
        ORDER BY ended_at DESC, id DESC LIMIT 10`
    ),
    pool.query(`SELECT kind, message, created_at FROM alerts ORDER BY created_at DESC, id DESC LIMIT 10`),
  ]);

  const requests = { pending: 0, approved: 0, rejected: 0, received: 0 };
  for (const r of byStatus.rows) requests[r.status] = r.count;

  res.json({
    low_stock: low.rows,
    expiring_soon: expiring.rows,
    requests_by_status: requests,
    pending_approvals: requests.pending,
    yield_per_batch: yields.rows.reverse(), // oldest -> newest, ready for a chart
    recent_alerts: alerts.rows,
  });
});

export default router;
