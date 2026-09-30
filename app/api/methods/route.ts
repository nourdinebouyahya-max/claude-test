import { route, ok, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction } from "@/lib/activity";
import { methodFields } from "@/lib/validators";

export const POST = route(async (req) => {
  const admin = await requireApiUser("admin");
  const f = methodFields(await readJson(req));
  const id = Number(
    db()
      .prepare("INSERT INTO receiving_methods (name, logo, holder, account, currency, instructions, enabled, created_at) VALUES (?,?,?,?,?,?,?,?)")
      .run(f.name, f.logo, f.holder, f.account, f.currency, f.instructions, f.enabled ? 1 : 0, Date.now()).lastInsertRowid,
  );
  logAction(admin, { action: "created", entity_type: "method", entity_id: id, after: f.enabled ? "enabled" : "disabled", details: f.name });
  return ok({ ok: true, id });
});
