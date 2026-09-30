import "server-only";
import { db } from "./db";
import type { SessionUser } from "./auth";

export type LogInput = {
  action: string;
  entity_type: "client" | "account" | "topup" | "payment" | "manager" | "pricing" | "method" | "expense" | "settings" | "auth" | "system";
  entity_id?: number | null;
  client_id?: number | null;
  before?: string | null;
  after?: string | null;
  details?: string | null;
  /** manager the action concerns (defaults to the client's manager) */
  manager_id?: number | null;
};

export function logAction(user: Pick<SessionUser, "id" | "name" | "role"> | null, e: LogInput) {
  let managerId = e.manager_id ?? null;
  let sample = 0;
  if (e.client_id) {
    const c = db().prepare("SELECT manager_id, is_sample FROM clients WHERE id = ?").get(e.client_id) as
      | { manager_id: number | null; is_sample: number }
      | undefined;
    if (managerId == null) managerId = c?.manager_id ?? null;
    sample = c?.is_sample ?? 0;
  }
  db()
    .prepare(
      `INSERT INTO activity_log (ts, user_id, user_name, role, action, entity_type, entity_id, client_id, manager_id, before_status, after_status, details, is_sample)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      Date.now(),
      user?.id ?? null,
      user?.name ?? "System",
      user?.role ?? "system",
      e.action,
      e.entity_type,
      e.entity_id ?? null,
      e.client_id ?? null,
      managerId,
      e.before ?? null,
      e.after ?? null,
      e.details ?? null,
      sample,
    );
}
