import "server-only";
import { db } from "./db";
import { ApiError, type SessionUser } from "./auth";
import { DEFAULT_PRICING, PRICING_KEYS, type PricingKey } from "./constants";

export type ClientRow = {
  id: number;
  business_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  markets: string | null;
  manager_id: number | null;
  notes: string | null;
  created_by: number | null;
  created_by_role: string | null;
  created_at: number;
  status: "active" | "archived";
  needs_review: number;
  reviewed_at: number | null;
  reviewed_by: number | null;
  is_sample: number;
};

/**
 * Loads a client and enforces ownership. Managers get a 404 for clients that are not theirs,
 * so they cannot even learn that a record exists.
 */
export function getClientFor(user: SessionUser, clientId: number): ClientRow {
  const c = db().prepare("SELECT * FROM clients WHERE id = ?").get(clientId) as ClientRow | undefined;
  if (!c || (user.role === "manager" && c.manager_id !== user.id)) throw new ApiError(404, "Client not found.");
  return c;
}

export function canSeeClient(user: SessionUser, c: { manager_id: number | null } | undefined) {
  return !!c && (user.role === "admin" || c.manager_id === user.id);
}

/** SQL fragment restricting rows to the user's clients. `alias` is the clients table alias. */
export function clientScope(user: SessionUser, alias = "c"): { sql: string; params: unknown[] } {
  if (user.role === "admin") return { sql: "1=1", params: [] };
  return { sql: `${alias}.manager_id = ?`, params: [user.id] };
}

export function defaultPricing(): Record<PricingKey, { price: number; fee: number }> {
  const rows = db().prepare("SELECT key, account_price, fee_pct FROM pricing WHERE client_id = 0").all() as {
    key: PricingKey;
    account_price: number;
    fee_pct: number;
  }[];
  const out = { ...DEFAULT_PRICING };
  for (const r of rows) out[r.key] = { price: r.account_price, fee: r.fee_pct };
  return out;
}

export function clientPricing(clientId: number): Record<PricingKey, { price: number; fee: number; custom: boolean }> {
  const defs = defaultPricing();
  const rows = db().prepare("SELECT key, account_price, fee_pct FROM pricing WHERE client_id = ?").all(clientId) as {
    key: PricingKey;
    account_price: number;
    fee_pct: number;
  }[];
  const out = {} as Record<PricingKey, { price: number; fee: number; custom: boolean }>;
  for (const k of PRICING_KEYS) out[k] = { ...defs[k], custom: false };
  for (const r of rows) {
    const custom = r.account_price !== defs[r.key]?.price || r.fee_pct !== defs[r.key]?.fee;
    out[r.key] = { price: r.account_price, fee: r.fee_pct, custom };
  }
  return out;
}

/** Copies the current defaults onto a new client (so later default changes don't silently reprice them). */
export function applyDefaultPricing(clientId: number, userId: number | null) {
  const defs = defaultPricing();
  const ins = db().prepare(
    "INSERT OR REPLACE INTO pricing (client_id, key, account_price, fee_pct, updated_at, updated_by) VALUES (?,?,?,?,?,?)",
  );
  for (const k of PRICING_KEYS) ins.run(clientId, k, defs[k].price, defs[k].fee, Date.now(), userId);
}
