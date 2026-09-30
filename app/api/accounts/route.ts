import crypto from "node:crypto";
import { route, ok, readJson, str, num } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { db, tx } from "@/lib/db";
import { logAction } from "@/lib/activity";
import { clientPricing, getClientFor } from "@/lib/access";
import { platformDetails } from "@/lib/validators";
import { PLATFORMS, PLATFORM_LABEL, TIME_ZONES, pricingKey, type Platform } from "@/lib/constants";
import { ymd } from "@/lib/format";

/** New account request: one or more platforms × 1–5 accounts each. */
export const POST = route(async (req) => {
  const user = await requireApiUser();
  const b = await readJson(req);
  const client = getClientFor(user, Number(b.client_id));
  if (client.status !== "active") throw new ApiError(400, "This client is archived.");
  const count = num(b, "count", "Number of accounts", { min: 1, max: 5, required: true });
  if (!Number.isInteger(count)) throw new ApiError(400, "Number of accounts must be 1–5.");
  const timezone = str(b, "timezone", { required: "Time zone", max: 60 });
  if (!TIME_ZONES.includes(timezone)) throw new ApiError(400, "Unsupported time zone.");
  const notes = str(b, "notes", { max: 2000 });
  const selected = (Array.isArray(b.platforms) ? b.platforms : []).filter((p): p is Platform => PLATFORMS.includes(p as Platform));
  if (!selected.length) throw new ApiError(400, "Select at least one platform.");
  const blocks = (b.details ?? {}) as Record<string, unknown>;
  const parsed = selected.map((p) => ({ platform: p, ...platformDetails(p, blocks[p]) })); // validates everything before writing
  const pricing = clientPricing(client.id);
  const now = Date.now();
  const group = crypto.randomUUID();

  const ids = tx(() => {
    const out: number[] = [];
    for (const item of parsed) {
      const pr = pricing[pricingKey(item.platform, item.origin)];
      const existing = (db().prepare("SELECT COUNT(*) n FROM accounts WHERE client_id = ? AND platform = ?").get(client.id, item.platform) as { n: number }).n;
      for (let i = 1; i <= count; i++) {
        const name = `${client.business_name} · ${PLATFORM_LABEL[item.platform]} ${String(existing + i).padStart(2, "0")} · ${ymd(now)}`;
        const id = Number(
          db()
            .prepare(
              `INSERT INTO accounts (group_id, client_id, platform, origin, name, timezone, account_price, fee_pct, status, details, notes, created_at, created_by, status_at)
               VALUES (?,?,?,?,?,?,?,?, 'requested', ?,?,?,?,?)`,
            )
            .run(group, client.id, item.platform, item.origin, name, timezone, pr.price, pr.fee, JSON.stringify(item.details), notes || null, now, user.id, now)
            .lastInsertRowid,
        );
        logAction(user, { action: "created", entity_type: "account", entity_id: id, client_id: client.id, after: "requested", details: `${name} · $${pr.price} · ${pr.fee}% fee` });
        out.push(id);
      }
    }
    return out;
  });
  return ok({ ok: true, ids });
});
