import { route, ok, readJson, str } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { db, tx } from "@/lib/db";
import { logAction } from "@/lib/activity";
import { getClientFor } from "@/lib/access";
import { clientFields } from "@/lib/validators";

export const PATCH = route(async (req, params) => {
  const user = await requireApiUser();
  const c = getClientFor(user, Number(params.id));
  const b = await readJson(req);
  const action = str(b, "action", { required: "Action" });
  const log = (action: string, before: string | null, after: string | null, details?: string) =>
    logAction(user, { action, entity_type: "client", entity_id: c.id, client_id: c.id, before, after, details });

  tx(() => {
    switch (action) {
      case "update": {
        const f = clientFields(b);
        const changed = (Object.keys(f) as (keyof typeof f)[]).filter((k) => (c[k] ?? "") !== f[k]);
        db()
          .prepare("UPDATE clients SET business_name=?, contact_name=?, phone=?, email=?, website=?, markets=?, notes=? WHERE id=?")
          .run(f.business_name, f.contact_name || null, f.phone || null, f.email || null, f.website || null, f.markets || null, f.notes || null, c.id);
        log("updated", null, null, changed.length ? `Changed: ${changed.join(", ")}` : "No changes");
        break;
      }
      case "archive":
      case "unarchive": {
        const next = action === "archive" ? "archived" : "active";
        db().prepare("UPDATE clients SET status = ? WHERE id = ?").run(next, c.id);
        log(action === "archive" ? "archived" : "restored", c.status, next);
        break;
      }
      case "reassign": {
        if (user.role !== "admin") throw new ApiError(403, "Only the admin can reassign clients.");
        const to = Number(b.manager_id);
        const m = db().prepare("SELECT id, name FROM users WHERE id = ? AND role='manager' AND archived=0").get(to) as { id: number; name: string } | undefined;
        if (!m) throw new ApiError(400, "Choose a manager.");
        const prev = c.manager_id ? (db().prepare("SELECT name FROM users WHERE id=?").get(c.manager_id) as { name: string } | undefined)?.name : null;
        db().prepare("UPDATE clients SET manager_id = ? WHERE id = ?").run(to, c.id);
        logAction(user, { action: "reassigned", entity_type: "client", entity_id: c.id, client_id: c.id, manager_id: to, before: prev ?? "Unassigned", after: m.name });
        break;
      }
      case "review": {
        if (user.role !== "admin") throw new ApiError(403, "Only the admin can review clients.");
        db().prepare("UPDATE clients SET needs_review = 0, reviewed_at = ?, reviewed_by = ? WHERE id = ?").run(Date.now(), user.id, c.id);
        log("reviewed", "needs_review", "reviewed", "Client checked and pricing confirmed");
        break;
      }
      default:
        throw new ApiError(400, "Unknown action.");
    }
  });
  return ok();
});
