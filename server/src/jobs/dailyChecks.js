import cron from 'node-cron';
import { pool } from '../db.js';
import { LOW_STOCK_SQL, EXPIRING_SQL } from '../queries.js';

// Looks for low stock and lots about to expire, and records one alert per issue per day.
// The UNIQUE(kind, ref, alert_date) constraint makes this safe to run twice (idempotent).
export async function runDailyChecks(db = pool, expiryDays = 30) {
  const { rows: low } = await db.query(LOW_STOCK_SQL);
  const { rows: expiring } = await db.query(EXPIRING_SQL, [expiryDays]);

  for (const item of low) {
    await db.query(
      `INSERT INTO alerts (kind, ref, message) VALUES ('low_stock', $1, $2)
       ON CONFLICT DO NOTHING`,
      [`item:${item.id}`, `Low stock: ${item.name} has ${item.stock} ${item.unit} (reorder level ${item.reorder_level})`]
    );
  }
  for (const lot of expiring) {
    const msg =
      lot.days_left < 0
        ? `Expired: lot ${lot.lot_number} (${lot.item_name}) still has ${lot.quantity_remaining} ${lot.unit}`
        : `Expiring in ${lot.days_left} days: lot ${lot.lot_number} (${lot.item_name}), ${lot.quantity_remaining} ${lot.unit} left`;
    await db.query(
      `INSERT INTO alerts (kind, ref, message) VALUES ('expiring_lot', $1, $2)
       ON CONFLICT DO NOTHING`,
      [`lot:${lot.id}`, msg]
    );
  }
  return { lowStock: low.length, expiring: expiring.length };
}

// Every day at 08:00 server time.
export function scheduleDailyChecks() {
  return cron.schedule('0 8 * * *', () => {
    runDailyChecks().catch((err) => console.error('Daily check failed:', err));
  });
}
