import { route, ok, readJson, str, num } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction } from "@/lib/activity";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { tzMidnight } from "@/lib/period";

export const POST = route(async (req) => {
  const admin = await requireApiUser("admin");
  const b = await readJson(req);
  const category = str(b, "category", { required: "Category" });
  if (!(category in EXPENSE_CATEGORIES)) throw new ApiError(400, "Unknown category.");
  const d = str(b, "date", { required: "Date" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new ApiError(400, "Invalid date.");
  const amount = num(b, "amount_usd", "Amount", { min: 0.01, max: 10_000_000, required: true });
  const description = str(b, "description", { max: 300 });
  const managerId = b.manager_id ? Number(b.manager_id) : null;
  if (managerId && !db().prepare("SELECT 1 FROM users WHERE id=? AND role='manager'").get(managerId)) throw new ApiError(400, "Unknown manager.");
  const id = Number(
    db()
      .prepare("INSERT INTO expenses (date, category, description, amount_usd, manager_id, created_by, created_at) VALUES (?,?,?,?,?,?,?)")
      .run(tzMidnight(d) + 12 * 3600_000, category, description || null, amount, managerId, admin.id, Date.now()).lastInsertRowid,
  );
  logAction(admin, { action: "created", entity_type: "expense", entity_id: id, manager_id: managerId, details: `$${amount} · ${EXPENSE_CATEGORIES[category as keyof typeof EXPENSE_CATEGORIES]}${description ? ` · ${description}` : ""}` });
  return ok({ ok: true, id });
});
