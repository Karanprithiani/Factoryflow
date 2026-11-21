// Write one row to the audit trail. `db` can be the pool or a transaction client,
// so the audit row is committed (or rolled back) together with the change itself.
export async function audit(db, userId, action, entity, entityId, details = null) {
  await db.query(
    `INSERT INTO audit_log (user_id, action, entity, entity_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, action, entity, entityId, details ? JSON.stringify(details) : null]
  );
}
