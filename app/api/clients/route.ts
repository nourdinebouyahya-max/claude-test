import { route, ok, readJson } from "@/lib/api";
import { clientFields } from "@/lib/validators";
import { ApiError, requireApiUser } from "@/lib/auth";
import { db, tx } from "@/lib/db";
import { logAction } from "@/lib/activity";
import { applyDefaultPricing } from "@/lib/access";

export const POST = route(async (req) => {
  const user = await requireApiUser();
  const b = await readJson(req);
  const f = clientFields(b);
  if (!f.phone && !f.email) throw new ApiError(400, "Add at least a phone number or an email.");
  let managerId: number | null = user.role === "manager" ? user.id : null;
  if (user.role === "admin" && b.manager_id) {
    managerId = Number(b.manager_id);
    if (!db().prepare("SELECT 1 FROM users WHERE id = ? AND role='manager' AND archived=0").get(managerId)) throw new ApiError(400, "Unknown manager.");
  }
  const id = tx(() => {
    const id = Number(
      db()
        .prepare(
          `INSERT INTO clients (business_name, contact_name, phone, email, website, markets, manager_id, notes, created_by, created_by_role, created_at, status, needs_review)
           VALUES (?,?,?,?,?,?,?,?,?,?,?, 'active', ?)`,
        )
        .run(f.business_name, f.contact_name || null, f.phone || null, f.email || null, f.website || null, f.markets || null, managerId, f.notes || null,
          user.id, user.role, Date.now(), user.role === "manager" ? 1 : 0).lastInsertRowid,
    );
    applyDefaultPricing(id, user.id);
    logAction(user, { action: "created", entity_type: "client", entity_id: id, client_id: id, after: "active", details: f.business_name });
    return id;
  });
  return ok({ ok: true, id });
});
