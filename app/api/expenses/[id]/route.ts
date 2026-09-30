import { route, ok } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction } from "@/lib/activity";

/** Expenses are archived, never deleted. */
export const PATCH = route(async (_req, params) => {
  const admin = await requireApiUser("admin");
  const id = Number(params.id);
  const e = db().prepare("SELECT amount_usd, description FROM expenses WHERE id = ? AND archived = 0").get(id) as { amount_usd: number; description: string | null } | undefined;
  if (!e) throw new ApiError(404, "Not found.");
  db().prepare("UPDATE expenses SET archived = 1 WHERE id = ?").run(id);
  logAction(admin, { action: "archived", entity_type: "expense", entity_id: id, details: `$${e.amount_usd}${e.description ? ` · ${e.description}` : ""}` });
  return ok();
});
