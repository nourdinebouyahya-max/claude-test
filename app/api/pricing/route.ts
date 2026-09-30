import { route, ok, readJson, num } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { db, tx } from "@/lib/db";
import { logAction } from "@/lib/activity";
import { defaultPricing } from "@/lib/access";
import { PRICING_KEYS, pricingKeyLabel } from "@/lib/constants";

/** Admin only: agency default prices (applied to new clients). */
export const PUT = route(async (req) => {
  const admin = await requireApiUser("admin");
  const b = await readJson(req);
  const current = defaultPricing();
  const changes: string[] = [];
  tx(() => {
    for (const k of PRICING_KEYS) {
      const price = num(b, `${k}.price`, `${pricingKeyLabel(k)} price`, { min: 0, max: 100000, required: true });
      const fee = num(b, `${k}.fee`, `${pricingKeyLabel(k)} fee`, { min: 0, max: 100, required: true });
      if (price !== current[k].price || fee !== current[k].fee)
        changes.push(`${pricingKeyLabel(k)}: $${current[k].price}/${current[k].fee}% → $${price}/${fee}%`);
      db()
        .prepare("INSERT OR REPLACE INTO pricing (client_id, key, account_price, fee_pct, updated_at, updated_by) VALUES (0,?,?,?,?,?)")
        .run(k, price, fee, Date.now(), admin.id);
    }
    logAction(admin, { action: "default_pricing_updated", entity_type: "pricing", entity_id: 0, details: changes.join(" · ") || "No changes" });
  });
  return ok();
});
