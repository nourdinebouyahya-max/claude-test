import { route, ok, readJson, str } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction } from "@/lib/activity";
import { methodFields } from "@/lib/validators";

export const PATCH = route(async (req, params) => {
  const admin = await requireApiUser("admin");
  const id = Number(params.id);
  const m = db().prepare("SELECT * FROM receiving_methods WHERE id = ? AND archived = 0").get(id) as { name: string; enabled: number } | undefined;
  if (!m) throw new ApiError(404, "Not found.");
  const b = await readJson(req);
  const action = str(b, "action", { required: "Action" });
  if (action === "toggle") {
    db().prepare("UPDATE receiving_methods SET enabled = ? WHERE id = ?").run(m.enabled ? 0 : 1, id);
    logAction(admin, { action: m.enabled ? "disabled" : "enabled", entity_type: "method", entity_id: id, before: m.enabled ? "enabled" : "disabled", after: m.enabled ? "disabled" : "enabled", details: m.name });
  } else if (action === "archive") {
    db().prepare("UPDATE receiving_methods SET archived = 1, enabled = 0 WHERE id = ?").run(id);
    logAction(admin, { action: "archived", entity_type: "method", entity_id: id, details: m.name });
  } else if (action === "update") {
    const f = methodFields(b);
    db()
      .prepare("UPDATE receiving_methods SET name=?, logo=?, holder=?, account=?, currency=?, instructions=?, enabled=? WHERE id=?")
      .run(f.name, f.logo, f.holder, f.account, f.currency, f.instructions, f.enabled ? 1 : 0, id);
    logAction(admin, { action: "updated", entity_type: "method", entity_id: id, details: f.name });
  } else throw new ApiError(400, "Unknown action.");
  return ok();
});
