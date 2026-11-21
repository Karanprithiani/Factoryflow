import { Router } from 'express';
import { pool } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { runDailyChecks } from '../jobs/dailyChecks.js';

const router = Router();
router.use(requireRole()); // admin only

// Run the daily check on demand (handy for demos).
router.post('/run-checks', async (req, res) => {
  res.json(await runDailyChecks());
});

router.get('/audit', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT a.id, a.action, a.entity, a.entity_id, a.details, a.created_at, u.name AS user_name
       FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.id DESC LIMIT 100`
  );
  res.json(rows);
});

export default router;
