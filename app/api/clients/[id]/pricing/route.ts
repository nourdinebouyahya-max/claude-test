import { route, ok, readJson, num } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { db, tx } from "@/lib/db";
import { logAction } from "@/lib/activity";
import { clientPricing, getClientFor } from "@/lib/access";
import { PRICING_KEYS, pricingKeyLabel } from "@/lib/constants";

/** Admin only: per-client account prices and top-up fees. */
export const PUT = route(async (req, params) => {
  const admin = await requireApiUser("admin");
  const c = getClientFor(admin, Number(params.id));
  const b = await readJson(req);
  const current = clientPricing(c.id);
  const changes: string[] = [];
  tx(() => {
    for (const k of PRICING_KEYS) {
      const price = num(b, `${k}.price`, `${pricingKeyLabel(k)} price`, { min: 0, max: 100000, required: true });
      const fee = num(b, `${k}.fee`, `${pricingKeyLabel(k)} fee`, { min: 0, max: 100, required: true });
      if (price !== current[k].price || fee !== current[k].fee)
        changes.push(`${pricingKeyLabel(k)}: $${current[k].price}/${current[k].fee}% → $${price}/${fee}%`);
      db()
        .prepare("INSERT OR REPLACE INTO pricing (client_id, key, account_price, fee_pct, updated_at, updated_by) VALUES (?,?,?,?,?,?)")
        .run(c.id, k, price, fee, Date.now(), admin.id);
    }
    if (b.confirm_review) db().prepare("UPDATE clients SET needs_review = 0, reviewed_at = ?, reviewed_by = ? WHERE id = ?").run(Date.now(), admin.id, c.id);
    logAction(admin, { action: "pricing_updated", entity_type: "pricing", entity_id: c.id, client_id: c.id, details: changes.join(" · ") || "No changes" });
    if (b.confirm_review && c.needs_review)
      logAction(admin, { action: "reviewed", entity_type: "client", entity_id: c.id, client_id: c.id, before: "needs_review", after: "reviewed", details: "Client checked and pricing confirmed" });
  });
  return ok();
});
