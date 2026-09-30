import { route, ok, readJson, num, str } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { db, tx } from "@/lib/db";
import { logAction } from "@/lib/activity";
import { CURRENCIES } from "@/lib/constants";
import { fxRates, minTopup } from "@/lib/queries";

export const PUT = route(async (req) => {
  const admin = await requireApiUser("admin");
  const b = await readJson(req);
  const prevFx = fxRates();
  const fx: Record<string, number> = { USD: 1 };
  for (const c of CURRENCIES) if (c !== "USD") fx[c] = num(b, `fx.${c}`, `${c} rate`, { min: 0.0001, max: 1000, required: true });
  const min = num(b, "min_topup_usd", "Minimum top-up", { min: 1, max: 100000, required: true });
  const agency = str(b, "agency_name", { max: 80 }) || "Adsolution";
  tx(() => {
    const set = db().prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)");
    set.run("fx_rates", JSON.stringify(fx));
    set.run("min_topup_usd", String(min));
    set.run("agency_name", agency);
    const changes = CURRENCIES.filter((c) => prevFx[c] !== fx[c]).map((c) => `1 ${c} = $${prevFx[c]} → $${fx[c]}`);
    if (minTopup() !== min) changes.push(`Minimum top-up → $${min}`);
    logAction(admin, { action: "settings_updated", entity_type: "settings", details: changes.join(" · ") || "Saved" });
  });
  return ok();
});
