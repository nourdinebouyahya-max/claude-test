import { route, ok, readJson, str } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction } from "@/lib/activity";
import { loadItem, transition } from "@/lib/workflow";
import { TIME_ZONES } from "@/lib/constants";

export const PATCH = route(async (req, params) => {
  const user = await requireApiUser();
  const id = Number(params.id);
  const b = await readJson(req);
  const action = str(b, "action", { required: "Action" });
  if (action === "update") {
    const row = loadItem(user, "account", id) as unknown as { client_id: number; ad_account_id: string | null; timezone: string | null; notes: string | null; status: string };
    const adId = str(b, "ad_account_id", { max: 100 });
    const tz = str(b, "timezone", { max: 60 }) || row.timezone || "Africa/Casablanca";
    if (!TIME_ZONES.includes(tz)) throw new ApiError(400, "Unsupported time zone.");
    const notes = str(b, "notes", { max: 2000 });
    db().prepare("UPDATE accounts SET ad_account_id = ?, timezone = ?, notes = ? WHERE id = ?").run(adId || null, tz, notes || null, id);
    const changes = [
      (row.ad_account_id ?? "") !== adId && `Ad account ID: ${row.ad_account_id || "—"} → ${adId || "—"}`,
      row.timezone !== tz && `Time zone: ${row.timezone} → ${tz}`,
      (row.notes ?? "") !== notes && "Notes updated",
    ].filter(Boolean);
    logAction(user, { action: "updated", entity_type: "account", entity_id: id, client_id: row.client_id, details: changes.join(" · ") || "No changes" });
    return ok();
  }
  const r = transition(user, "account", id, action, { reason: str(b, "reason", { max: 1000 }), ad_account_id: str(b, "ad_account_id", { max: 100 }) });
  return ok({ ok: true, ...r });
});
