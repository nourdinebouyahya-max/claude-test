import "server-only";
import { db } from "./db";
import type { SessionUser } from "./auth";
import { clientScope } from "./access";
import { tzMidnight, addDays } from "./period";
import { DEFAULT_FX, OPEN_ACCOUNT, OPEN_PAYMENT, OPEN_TOPUP, type Currency } from "./constants";

export type Filters = {
  manager?: string;
  client?: string;
  platform?: string;
  status?: string;
  q?: string;
  from?: string;
  to?: string;
  review?: string;
  view?: string;
};

type Where = { parts: string[]; params: unknown[] };

function base(user: SessionUser, alias = "c"): Where {
  const s = clientScope(user, alias);
  return { parts: [s.sql], params: [...s.params] };
}

const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

function common(w: Where, f: Filters, user: SessionUser, t: string, dateCol = `${t}.created_at`) {
  if (f.manager && user.role === "admin") {
    w.parts.push("c.manager_id = ?");
    w.params.push(Number(f.manager));
  }
  if (f.client) {
    w.parts.push("c.id = ?");
    w.params.push(Number(f.client));
  }
  if (isDate(f.from)) {
    w.parts.push(`${dateCol} >= ?`);
    w.params.push(tzMidnight(f.from!));
  }
  if (isDate(f.to)) {
    w.parts.push(`${dateCol} < ?`);
    w.params.push(tzMidnight(addDays(f.to!, 1)));
  }
}

const sql = (w: Where) => w.parts.join(" AND ");

/* ---------------- Clients ---------------- */

export type ClientListRow = {
  id: number;
  business_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  markets: string | null;
  manager_id: number | null;
  manager_name: string | null;
  status: string;
  needs_review: number;
  created_at: number;
  created_by_name: string | null;
  created_by_role: string | null;
  is_sample: number;
  accounts: number;
  active_accounts: number;
  volume: number;
  fees: number;
  platforms: string | null;
};

export function listClients(user: SessionUser, f: Filters): ClientListRow[] {
  const w = base(user);
  common(w, f, user, "c");
  if (f.status === "active" || f.status === "archived") {
    w.parts.push("c.status = ?");
    w.params.push(f.status);
  } else if (!f.status) {
    w.parts.push("c.status = 'active'");
  }
  if (f.review === "1") w.parts.push("c.needs_review = 1");
  if (f.platform) {
    w.parts.push("EXISTS (SELECT 1 FROM accounts a WHERE a.client_id = c.id AND a.platform = ?)");
    w.params.push(f.platform);
  }
  if (f.q) {
    w.parts.push("(c.business_name LIKE ? OR c.contact_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)");
    const q = `%${f.q}%`;
    w.params.push(q, q, q, q);
  }
  return db()
    .prepare(
      `SELECT c.*, m.name manager_name, cb.name created_by_name,
        (SELECT COUNT(*) FROM accounts a WHERE a.client_id = c.id) accounts,
        (SELECT COUNT(*) FROM accounts a WHERE a.client_id = c.id AND a.status = 'active') active_accounts,
        (SELECT COALESCE(SUM(usd_amount),0) FROM topups t WHERE t.client_id = c.id AND t.status = 'completed') volume,
        (SELECT COALESCE(SUM(fee_amount),0) FROM topups t WHERE t.client_id = c.id AND t.status = 'completed') fees,
        (SELECT GROUP_CONCAT(DISTINCT platform) FROM accounts a WHERE a.client_id = c.id) platforms
       FROM clients c LEFT JOIN users m ON m.id = c.manager_id LEFT JOIN users cb ON cb.id = c.created_by
       WHERE ${sql(w)} ORDER BY c.needs_review DESC, c.created_at DESC LIMIT 1000`,
    )
    .all(...w.params) as ClientListRow[];
}

export function clientOptions(user: SessionUser, activeOnly = true) {
  const w = base(user);
  if (activeOnly) w.parts.push("c.status = 'active'");
  return db()
    .prepare(`SELECT c.id, c.business_name, c.manager_id FROM clients c WHERE ${sql(w)} ORDER BY c.business_name`)
    .all(...w.params) as { id: number; business_name: string; manager_id: number | null }[];
}

/* ---------------- Accounts ---------------- */

export type AccountRow = {
  id: number;
  group_id: string;
  client_id: number;
  client_name: string;
  manager_id: number | null;
  manager_name: string | null;
  platform: string;
  origin: string | null;
  name: string;
  ad_account_id: string | null;
  timezone: string | null;
  account_price: number;
  fee_pct: number;
  status: string;
  details: string;
  notes: string | null;
  reject_reason: string | null;
  created_at: number;
  created_by_name: string | null;
  handled_by_name: string | null;
  first_response_at: number | null;
  decided_at: number | null;
  status_at: number;
  is_sample: number;
  volume: number;
};

const ACCOUNT_SELECT = `SELECT a.*, c.business_name client_name, c.manager_id, m.name manager_name, cb.name created_by_name, hb.name handled_by_name,
  (SELECT COALESCE(SUM(usd_amount),0) FROM topups t WHERE t.account_id = a.id AND t.status='completed') volume
  FROM accounts a JOIN clients c ON c.id = a.client_id LEFT JOIN users m ON m.id = c.manager_id
  LEFT JOIN users cb ON cb.id = a.created_by LEFT JOIN users hb ON hb.id = a.handled_by`;

export function listAccounts(user: SessionUser, f: Filters): AccountRow[] {
  const w = base(user);
  common(w, f, user, "a");
  if (f.platform) {
    w.parts.push("a.platform = ?");
    w.params.push(f.platform);
  }
  if (f.status === "open") w.parts.push(`a.status IN (${OPEN_ACCOUNT.map(() => "?").join(",")})`), w.params.push(...OPEN_ACCOUNT);
  else if (f.status) w.parts.push("a.status = ?"), w.params.push(f.status);
  if (f.q) {
    w.parts.push("(a.name LIKE ? OR a.ad_account_id LIKE ? OR c.business_name LIKE ?)");
    const q = `%${f.q}%`;
    w.params.push(q, q, q);
  }
  return db().prepare(`${ACCOUNT_SELECT} WHERE ${sql(w)} ORDER BY a.created_at DESC LIMIT 2000`).all(...w.params) as AccountRow[];
}

export function accountsForClient(clientId: number): AccountRow[] {
  return db().prepare(`${ACCOUNT_SELECT} WHERE a.client_id = ? ORDER BY a.created_at DESC`).all(clientId) as AccountRow[];
}

/** Active ad accounts, grouped for the top-up form. */
export function activeAccountOptions(user: SessionUser) {
  const w = base(user);
  w.parts.push("a.status = 'active'", "c.status = 'active'");
  return db()
    .prepare(
      `SELECT a.id, a.client_id, a.name, a.platform, a.origin, a.ad_account_id FROM accounts a JOIN clients c ON c.id = a.client_id
       WHERE ${sql(w)} ORDER BY a.name`,
    )
    .all(...w.params) as { id: number; client_id: number; name: string; platform: string; origin: string | null; ad_account_id: string | null }[];
}

/* ---------------- Top-ups ---------------- */

export type TopupRow = {
  id: number;
  client_id: number;
  client_name: string;
  manager_id: number | null;
  manager_name: string | null;
  account_id: number;
  account_name: string;
  ad_account_id: string | null;
  platform: string;
  amount: number;
  currency: string;
  usd_amount: number;
  method_id: number | null;
  method_name: string | null;
  method_logo: string | null;
  reference: string | null;
  proof_path: string | null;
  proof_name: string | null;
  proof_mime: string | null;
  fee_pct: number;
  fee_amount: number;
  net_amount: number;
  status: string;
  reject_reason: string | null;
  notes: string | null;
  created_at: number;
  created_by_name: string | null;
  handled_by_name: string | null;
  first_response_at: number | null;
  decided_at: number | null;
  status_at: number;
  is_sample: number;
};

const TOPUP_SELECT = `SELECT t.*, c.business_name client_name, c.manager_id, m.name manager_name, a.name account_name, a.ad_account_id, a.platform,
  rm.name method_name, rm.logo method_logo, cb.name created_by_name, hb.name handled_by_name
  FROM topups t JOIN clients c ON c.id = t.client_id JOIN accounts a ON a.id = t.account_id LEFT JOIN users m ON m.id = c.manager_id
  LEFT JOIN receiving_methods rm ON rm.id = t.method_id LEFT JOIN users cb ON cb.id = t.created_by LEFT JOIN users hb ON hb.id = t.handled_by`;

export function listTopups(user: SessionUser, f: Filters): TopupRow[] {
  const w = base(user);
  common(w, f, user, "t");
  if (f.platform) w.parts.push("a.platform = ?"), w.params.push(f.platform);
  if (f.status === "open") w.parts.push(`t.status IN (${OPEN_TOPUP.map(() => "?").join(",")})`), w.params.push(...OPEN_TOPUP);
  else if (f.status) w.parts.push("t.status = ?"), w.params.push(f.status);
  if (f.q) {
    const q = `%${f.q}%`;
    w.parts.push("(t.reference LIKE ? OR c.business_name LIKE ? OR a.name LIKE ? OR a.ad_account_id LIKE ?)");
    w.params.push(q, q, q, q);
  }
  return db().prepare(`${TOPUP_SELECT} WHERE ${sql(w)} ORDER BY t.created_at DESC LIMIT 2000`).all(...w.params) as TopupRow[];
}

export function topupsForClient(clientId: number): TopupRow[] {
  return db().prepare(`${TOPUP_SELECT} WHERE t.client_id = ? ORDER BY t.created_at DESC`).all(clientId) as TopupRow[];
}

/* ---------------- Payments ---------------- */

export type PaymentRow = {
  id: number;
  client_id: number;
  client_name: string;
  manager_id: number | null;
  manager_name: string | null;
  purpose: string;
  account_id: number | null;
  account_name: string | null;
  amount: number;
  currency: string;
  usd_amount: number;
  method_id: number | null;
  method_name: string | null;
  method_logo: string | null;
  reference: string | null;
  proof_path: string | null;
  proof_name: string | null;
  proof_mime: string | null;
  status: string;
  reject_reason: string | null;
  notes: string | null;
  created_at: number;
  created_by_name: string | null;
  handled_by_name: string | null;
  first_response_at: number | null;
  decided_at: number | null;
  status_at: number;
  is_sample: number;
  platform: string | null;
};

const PAYMENT_SELECT = `SELECT p.*, c.business_name client_name, c.manager_id, m.name manager_name, a.name account_name, a.platform,
  rm.name method_name, rm.logo method_logo, cb.name created_by_name, hb.name handled_by_name
  FROM payments p JOIN clients c ON c.id = p.client_id LEFT JOIN accounts a ON a.id = p.account_id LEFT JOIN users m ON m.id = c.manager_id
  LEFT JOIN receiving_methods rm ON rm.id = p.method_id LEFT JOIN users cb ON cb.id = p.created_by LEFT JOIN users hb ON hb.id = p.handled_by`;

export function listPayments(user: SessionUser, f: Filters): PaymentRow[] {
  const w = base(user);
  common(w, f, user, "p");
  if (f.platform) w.parts.push("a.platform = ?"), w.params.push(f.platform);
  if (f.status === "open") w.parts.push("p.status = 'pending'");
  else if (f.status) w.parts.push("p.status = ?"), w.params.push(f.status);
  if (f.q) {
    const q = `%${f.q}%`;
    w.parts.push("(p.reference LIKE ? OR c.business_name LIKE ?)");
    w.params.push(q, q);
  }
  return db().prepare(`${PAYMENT_SELECT} WHERE ${sql(w)} ORDER BY p.created_at DESC LIMIT 2000`).all(...w.params) as PaymentRow[];
}

export function paymentsForClient(clientId: number): PaymentRow[] {
  return db().prepare(`${PAYMENT_SELECT} WHERE p.client_id = ? ORDER BY p.created_at DESC`).all(clientId) as PaymentRow[];
}

/* ---------------- Tasks (one queue) ---------------- */

export type TaskRow = {
  kind: "account" | "topup" | "payment";
  id: number;
  client_id: number;
  client_name: string;
  manager_id: number | null;
  manager_name: string | null;
  title: string;
  platform: string | null;
  amount: number | null;
  status: string;
  created_at: number;
  status_at: number;
  first_response_at: number | null;
  decided_at: number | null;
  reject_reason: string | null;
  ad_account_id: string | null;
  proof_path: string | null;
  handled_by_name: string | null;
  created_by_name: string | null;
};

export function listTasks(user: SessionUser, f: Filters & { view?: string }): TaskRow[] {
  const view = f.view === "closed" || f.view === "all" ? f.view : "open";
  const w = base(user);
  if (f.manager && user.role === "admin") w.parts.push("c.manager_id = ?"), w.params.push(Number(f.manager));
  if (f.client) w.parts.push("c.id = ?"), w.params.push(Number(f.client));
  const scope = sql(w);
  const inList = (arr: string[]) => arr.map((s) => `'${s}'`).join(",");
  const cond = (col: string, open: string[]) =>
    view === "open" ? `${col} IN (${inList(open)})` : view === "closed" ? `${col} NOT IN (${inList(open)})` : "1=1";
  const q = `
    SELECT 'account' kind, a.id, a.client_id, c.business_name client_name, c.manager_id, m.name manager_name, a.name title, a.platform,
      a.account_price amount, a.status status, a.created_at created_at, a.status_at status_at, a.first_response_at first_response_at, a.decided_at decided_at, a.reject_reason reject_reason, a.ad_account_id ad_account_id, NULL proof_path,
      hb.name handled_by_name, cb.name created_by_name
    FROM accounts a JOIN clients c ON c.id = a.client_id LEFT JOIN users m ON m.id = c.manager_id LEFT JOIN users hb ON hb.id = a.handled_by LEFT JOIN users cb ON cb.id = a.created_by
    WHERE ${scope} AND ${cond("a.status", OPEN_ACCOUNT)}
    UNION ALL
    SELECT 'topup', t.id, t.client_id, c.business_name, c.manager_id, m.name, 'Top-up · ' || a.name, a.platform,
      t.usd_amount, t.status, t.created_at, t.status_at, t.first_response_at, t.decided_at, t.reject_reason, a.ad_account_id, t.proof_path,
      hb.name, cb.name
    FROM topups t JOIN clients c ON c.id = t.client_id JOIN accounts a ON a.id = t.account_id LEFT JOIN users m ON m.id = c.manager_id LEFT JOIN users hb ON hb.id = t.handled_by LEFT JOIN users cb ON cb.id = t.created_by
    WHERE ${scope} AND ${cond("t.status", OPEN_TOPUP)}
    UNION ALL
    SELECT 'payment', p.id, p.client_id, c.business_name, c.manager_id, m.name,
      CASE p.purpose WHEN 'account_order' THEN 'Payment · account order' ELSE 'Payment · general' END, a.platform,
      p.usd_amount, p.status, p.created_at, p.status_at, p.first_response_at, p.decided_at, p.reject_reason, NULL, p.proof_path,
      hb.name, cb.name
    FROM payments p JOIN clients c ON c.id = p.client_id LEFT JOIN accounts a ON a.id = p.account_id LEFT JOIN users m ON m.id = c.manager_id LEFT JOIN users hb ON hb.id = p.handled_by LEFT JOIN users cb ON cb.id = p.created_by
    WHERE ${scope} AND ${cond("p.status", OPEN_PAYMENT)}
    ORDER BY ${view === "open" ? "status_at ASC" : "created_at DESC"} LIMIT 1000`;
  return db()
    .prepare(q)
    .all(...w.params, ...w.params, ...w.params) as TaskRow[];
}

/* ---------------- Activity ---------------- */

export type LogRow = {
  id: number;
  ts: number;
  user_id: number | null;
  user_name: string | null;
  role: string | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  client_id: number | null;
  client_name: string | null;
  manager_id: number | null;
  before_status: string | null;
  after_status: string | null;
  details: string | null;
};

export function listActivity(opts: {
  user?: number;
  manager?: number;
  client?: number;
  entity?: { type: string; id: number };
  from?: string;
  to?: string;
  limit?: number;
}): LogRow[] {
  const parts = ["1=1"];
  const params: unknown[] = [];
  if (opts.manager) parts.push("(l.user_id = ? OR l.manager_id = ?)"), params.push(opts.manager, opts.manager);
  if (opts.user) parts.push("l.user_id = ?"), params.push(opts.user);
  if (opts.client) parts.push("l.client_id = ?"), params.push(opts.client);
  if (opts.entity) parts.push("l.entity_type = ? AND l.entity_id = ?"), params.push(opts.entity.type, opts.entity.id);
  if (isDate(opts.from)) parts.push("l.ts >= ?"), params.push(tzMidnight(opts.from!));
  if (isDate(opts.to)) parts.push("l.ts < ?"), params.push(tzMidnight(addDays(opts.to!, 1)));
  return db()
    .prepare(
      `SELECT l.*, c.business_name client_name FROM activity_log l LEFT JOIN clients c ON c.id = l.client_id
       WHERE ${parts.join(" AND ")} ORDER BY l.ts DESC, l.id DESC LIMIT ?`,
    )
    .all(...params, opts.limit ?? 300) as LogRow[];
}

/* ---------------- Misc ---------------- */

export type MethodRow = {
  id: number;
  name: string;
  logo: string | null;
  holder: string | null;
  account: string | null;
  currency: string | null;
  instructions: string | null;
  enabled: number;
  is_sample: number;
};

export function listMethods(enabledOnly: boolean): MethodRow[] {
  return db()
    .prepare(`SELECT * FROM receiving_methods WHERE archived = 0 ${enabledOnly ? "AND enabled = 1" : ""} ORDER BY enabled DESC, name`)
    .all() as MethodRow[];
}

export type ManagerBasic = { id: number; name: string; email: string; phone: string | null; status: string; created_at: number; is_sample: number };

export function listManagerBasics(includeArchived = false): ManagerBasic[] {
  return db()
    .prepare(
      `SELECT id, name, email, phone, status, created_at, is_sample FROM users WHERE role = 'manager' ${includeArchived ? "" : "AND archived = 0"} ORDER BY name`,
    )
    .all() as ManagerBasic[];
}

export function getSetting(key: string): string | null {
  const r = db().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return r?.value ?? null;
}

export function fxRates(): Record<Currency, number> {
  try {
    return { ...DEFAULT_FX, ...JSON.parse(getSetting("fx_rates") ?? "{}") };
  } catch {
    return { ...DEFAULT_FX };
  }
}

export function minTopup(): number {
  const v = Number(getSetting("min_topup_usd"));
  return Number.isFinite(v) && v > 0 ? v : 100;
}

export function hasSamples(): boolean {
  return !!db().prepare("SELECT 1 FROM users WHERE is_sample = 1 UNION SELECT 1 FROM clients WHERE is_sample = 1 LIMIT 1").get();
}

export function reviewCount(): number {
  return (db().prepare("SELECT COUNT(*) n FROM clients WHERE needs_review = 1 AND status = 'active'").get() as { n: number }).n;
}
