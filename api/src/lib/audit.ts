import type { DbClient } from "../db/pool.js";

type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "merge"
  | "verify"
  | "suppress"
  | "export"
  | "restore";

export async function writeAudit(
  db: DbClient,
  input: {
    entityType: string;
    entityId?: string | null;
    action: AuditAction;
    actor?: string | null;
    before?: unknown;
    after?: unknown;
    context?: Record<string, unknown>;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO audit_logs (entity_type, entity_id, action, actor, before_state, after_state, context)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.entityType,
      input.entityId ?? null,
      input.action,
      input.actor ?? "system",
      input.before ? JSON.stringify(input.before) : null,
      input.after ? JSON.stringify(input.after) : null,
      JSON.stringify(input.context ?? {}),
    ],
  );
}
