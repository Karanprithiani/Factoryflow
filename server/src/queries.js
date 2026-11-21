// SQL shared by the dashboard and the daily scheduled job.

// Items whose usable stock (not expired) is at or below the reorder level.
export const LOW_STOCK_SQL = `
  SELECT i.id, i.name, i.unit, i.reorder_level,
         COALESCE(SUM(l.quantity_remaining)
           FILTER (WHERE l.expiry_date IS NULL OR l.expiry_date >= CURRENT_DATE), 0) AS stock
    FROM items i
    LEFT JOIN lots l ON l.item_id = i.id
   GROUP BY i.id
  HAVING COALESCE(SUM(l.quantity_remaining)
           FILTER (WHERE l.expiry_date IS NULL OR l.expiry_date >= CURRENT_DATE), 0) <= i.reorder_level
   ORDER BY i.name`;

// Lots that still have stock and expire within the next $1 days (or already expired).
export const EXPIRING_SQL = `
  SELECT l.id, l.lot_number, i.name AS item_name, i.unit, l.quantity_remaining, l.expiry_date,
         (l.expiry_date - CURRENT_DATE) AS days_left
    FROM lots l JOIN items i ON i.id = l.item_id
   WHERE l.quantity_remaining > 0
     AND l.expiry_date IS NOT NULL
     AND l.expiry_date <= CURRENT_DATE + $1::int
   ORDER BY l.expiry_date`;
