/**
 * Audit Logger
 *
 * Writes admin actions to the AuditLog table for compliance and traceability.
 * Used as a fire-and-forget helper — errors are logged but never thrown.
 */
const db = require("../configure/dbClient");

/**
 * Log an admin action.
 *
 * @param {string}  action        - Human-readable action, e.g. "PRODUCT_CREATED"
 * @param {string}  entityType    - Table/entity name, e.g. "Product", "Order", "User"
 * @param {string}  entityId      - UUID of the affected record (nullable)
 * @param {string}  performedById - UUID of the admin/user who performed the action
 * @param {object}  [changes]     - Optional JSON diff or summary of changes
 */
const logAudit = async (action, entityType, entityId, performedById, changes = null) => {
  try {
    await db.auditlog.create({
      data: {
        action,
        entityType,
        entityId: entityId || null,
        performedById: performedById || null,
        changes: changes || null,
      },
    });
  } catch (err) {
    // Audit logging should never break the main request
    console.error("[AuditLog] Failed to write audit entry:", err.message);
  }
};

module.exports = { logAudit };
