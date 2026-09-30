import "server-only";
import { db } from "./db";
import type { Period } from "./period";
import { addDays, tzMidnight } from "./period";
import { ymd } from "./format";
import { OPEN_ACCOUNT, OPEN_PAYMENT, OPEN_TOPUP } from "./constants";

const H24 = 24 * 3600_000;
const inList = (a: string[]) => a.map((s) => `'${s}'`).join(",");

/** Every trackable request (account requests, top-ups, payments) as one virtual table. */
const ITEMS = `
  SELECT 'account' kind, id, client_id, status, created_at, first_response_at, decided_at, status_at, handled_by,
    CASE WHEN status IN (${inList(OPEN_ACCOUNT)}) THEN 1 ELSE 0 END is_open FROM accounts
  UNION ALL
  SELECT 'topup', id, client_id, status, created_at, first_response_at, decided_at, status_at, handled_by,
    CASE WHEN status IN (${inList(OPEN_TOPUP)}) THEN 1 ELSE 0 END FROM topups
  UNION ALL
  SELECT 'payment', id, client_id, status, created_at, first_response_at, decided_at, status_at, handled_by,
    CASE WHEN status IN (${inList(OPEN_PAYMENT)}) THEN 1 ELSE 0 END FROM payments`;

export type ManagerBadge = "Working" | "Quiet" | "Inactive" | "Overdue";

export type ManagerKpi = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  is_sample: number;
  created_at: number;
  clients: number;
  new_clients: number;
  active_accounts: number;
  topups: number;
  volume: number;
  fees: number;
  open_items: number;
  overdue_items: number;
  avg_first_ms: number | null;
  avg_complete_ms: number | null;
  rejections: number;
  last_activity: number | null;
  badge: ManagerBadge;
};

export function badgeFor(lastActivity: number | null, overdue: number, now = Date.now()): ManagerBadge {
  if (overdue > 0) return "Overdue";
  if (lastActivity && now - lastActivity < H24) return "Working";
  if (lastActivity && now - lastActivity <= 3 * H24) return "Quiet";
  return "Inactive";
}

export function managerKpis(p: Period, managerId?: number): ManagerKpi[] {
  const now = Date.now();
  const rows = db()
    .prepare(
      `WITH items AS (${ITEMS})
      SELECT u.id, u.name, u.email, u.phone, u.status, u.is_sample, u.created_at,
        (SELECT COUNT(*) FROM clients c WHERE c.manager_id = u.id AND c.status = 'active') clients,
        (SELECT COUNT(*) FROM clients c WHERE c.manager_id = u.id AND c.created_at >= @from AND c.created_at < @to) new_clients,
        (SELECT COUNT(*) FROM accounts a JOIN clients c ON c.id = a.client_id WHERE c.manager_id = u.id AND a.status = 'active') active_accounts,
        (SELECT COUNT(*) FROM topups t JOIN clients c ON c.id = t.client_id WHERE c.manager_id = u.id AND t.status = 'completed' AND t.decided_at >= @from AND t.decided_at < @to) topups,
        (SELECT COALESCE(SUM(t.usd_amount),0) FROM topups t JOIN clients c ON c.id = t.client_id WHERE c.manager_id = u.id AND t.status = 'completed' AND t.decided_at >= @from AND t.decided_at < @to) volume,
        (SELECT COALESCE(SUM(t.fee_amount),0) FROM topups t JOIN clients c ON c.id = t.client_id WHERE c.manager_id = u.id AND t.status = 'completed' AND t.decided_at >= @from AND t.decided_at < @to) fees,
        (SELECT COUNT(*) FROM items i JOIN clients c ON c.id = i.client_id WHERE c.manager_id = u.id AND i.is_open = 1) open_items,
        (SELECT COUNT(*) FROM items i JOIN clients c ON c.id = i.client_id WHERE c.manager_id = u.id AND i.is_open = 1 AND i.status_at < @overdue) overdue_items,
        (SELECT AVG(i.first_response_at - i.created_at) FROM items i JOIN clients c ON c.id = i.client_id WHERE c.manager_id = u.id AND i.first_response_at IS NOT NULL AND i.created_at >= @from AND i.created_at < @to) avg_first_ms,
        (SELECT AVG(i.decided_at - i.created_at) FROM items i JOIN clients c ON c.id = i.client_id WHERE c.manager_id = u.id AND i.decided_at IS NOT NULL AND i.status != 'rejected' AND i.decided_at >= @from AND i.decided_at < @to) avg_complete_ms,
        (SELECT COUNT(*) FROM items i JOIN clients c ON c.id = i.client_id WHERE c.manager_id = u.id AND i.status = 'rejected' AND i.decided_at >= @from AND i.decided_at < @to) rejections,
        (SELECT MAX(ts) FROM activity_log l WHERE l.user_id = u.id) last_activity
      FROM users u WHERE u.role = 'manager' AND u.archived = 0 ${managerId ? "AND u.id = @mid" : ""}
      ORDER BY u.status = 'active' DESC, u.name`,
    )
    .all({ from: p.from, to: p.to, overdue: now - H24, mid: managerId ?? 0 }) as Omit<ManagerKpi, "badge">[];
  return rows.map((r) => ({ ...r, badge: badgeFor(r.last_activity, r.overdue_items, now) }));
}

/* ---------------- Admin overview ---------------- */

export function adminOverview(p: Period) {
  const q = (s: string, params: Record<string, unknown> = {}) =>
    db().prepare(s).get({ from: p.from, to: p.to, ...params }) as Record<string, number>;
  const totals = {
    clients: q("SELECT COUNT(*) n FROM clients WHERE status='active'").n,
    new_clients: q("SELECT COUNT(*) n FROM clients WHERE created_at >= @from AND created_at < @to").n,
    active_accounts: q("SELECT COUNT(*) n FROM accounts WHERE status='active'").n,
    open_requests: q(`SELECT COUNT(*) n FROM accounts WHERE status IN (${inList(OPEN_ACCOUNT)})`).n,
    ...q(
      "SELECT COUNT(*) topups, COALESCE(SUM(usd_amount),0) volume, COALESCE(SUM(fee_amount),0) fees FROM topups WHERE status='completed' AND decided_at >= @from AND decided_at < @to",
    ),
    pending_proofs:
      q("SELECT COUNT(*) n FROM topups WHERE status='requested'").n + q("SELECT COUNT(*) n FROM payments WHERE status='pending'").n,
    rejected: q(`WITH items AS (${ITEMS}) SELECT COUNT(*) n FROM items WHERE status='rejected' AND decided_at >= @from AND decided_at < @to`).n,
    overdue: q(`WITH items AS (${ITEMS}) SELECT COUNT(*) n FROM items WHERE is_open = 1 AND status_at < @od`, { od: Date.now() - H24 }).n,
  } as {
    clients: number;
    new_clients: number;
    active_accounts: number;
    open_requests: number;
    topups: number;
    volume: number;
    fees: number;
    pending_proofs: number;
    rejected: number;
    overdue: number;
  };

  const completed = db()
    .prepare(
      `SELECT t.decided_at, t.usd_amount, t.fee_amount, a.platform, c.id client_id, c.business_name, c.manager_id, m.name manager_name
       FROM topups t JOIN accounts a ON a.id = t.account_id JOIN clients c ON c.id = t.client_id LEFT JOIN users m ON m.id = c.manager_id
       WHERE t.status='completed' AND t.decided_at >= ? AND t.decided_at < ?`,
    )
    .all(p.from, p.to) as {
    decided_at: number;
    usd_amount: number;
    fee_amount: number;
    platform: string;
    client_id: number;
    business_name: string;
    manager_id: number | null;
    manager_name: string | null;
  }[];

  // daily series (agency time zone)
  const days: string[] = [];
  for (let d = p.fromStr; d <= p.toStr && days.length < 400; d = addDays(d, 1)) days.push(d);
  const byDay = new Map(days.map((d) => [d, 0]));
  const byPlatform = new Map<string, number>();
  const byManager = new Map<string, number>();
  const byClient = new Map<number, { name: string; value: number }>();
  for (const t of completed) {
    const d = ymd(t.decided_at);
    byDay.set(d, (byDay.get(d) ?? 0) + t.usd_amount);
    byPlatform.set(t.platform, (byPlatform.get(t.platform) ?? 0) + t.usd_amount);
    const mn = t.manager_name ?? "Unassigned";
    byManager.set(mn, (byManager.get(mn) ?? 0) + t.usd_amount);
    const c = byClient.get(t.client_id) ?? { name: t.business_name, value: 0 };
    c.value += t.usd_amount;
    byClient.set(t.client_id, c);
  }
  return {
    totals,
    series: [...byDay.entries()].map(([label, value]) => ({ label, value })),
    platforms: [...byPlatform.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
    managers: [...byManager.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
    topClients: [...byClient.entries()]
      .map(([id, v]) => ({ id, label: v.name, value: v.value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6),
  };
}

/* ---------------- Manager overview ---------------- */

export function managerOverview(managerId: number, month: Period) {
  const g = (s: string, ...params: unknown[]) => db().prepare(s).get(...params) as Record<string, number>;
  return {
    clients: g("SELECT COUNT(*) n FROM clients WHERE manager_id = ? AND status='active'", managerId).n,
    active_accounts: g(
      "SELECT COUNT(*) n FROM accounts a JOIN clients c ON c.id=a.client_id WHERE c.manager_id = ? AND a.status='active'",
      managerId,
    ).n,
    open_requests: g(
      `SELECT COUNT(*) n FROM accounts a JOIN clients c ON c.id=a.client_id WHERE c.manager_id = ? AND a.status IN (${inList(OPEN_ACCOUNT)})`,
      managerId,
    ).n,
    ...(g(
      `SELECT COUNT(*) topups, COALESCE(SUM(t.usd_amount),0) volume, COALESCE(SUM(t.fee_amount),0) fees FROM topups t JOIN clients c ON c.id=t.client_id
       WHERE c.manager_id = ? AND t.status='completed' AND t.decided_at >= ? AND t.decided_at < ?`,
      managerId,
      month.from,
      month.to,
    ) as { topups: number; volume: number; fees: number }),
  } as { clients: number; active_accounts: number; open_requests: number; topups: number; volume: number; fees: number };
}

/* ---------------- Finance ---------------- */

export function finance(p: Period) {
  const accountSales = db()
    .prepare(
      `SELECT c.manager_id, COALESCE(SUM(a.account_price),0) v, COUNT(*) n FROM accounts a JOIN clients c ON c.id=a.client_id
       WHERE a.decided_at >= ? AND a.decided_at < ? AND a.status != 'rejected' GROUP BY c.manager_id`,
    )
    .all(p.from, p.to) as { manager_id: number | null; v: number; n: number }[];
  const fees = db()
    .prepare(
      `SELECT c.manager_id, COALESCE(SUM(t.fee_amount),0) v, COALESCE(SUM(t.usd_amount),0) vol, COUNT(*) n FROM topups t JOIN clients c ON c.id=t.client_id
       WHERE t.status='completed' AND t.decided_at >= ? AND t.decided_at < ? GROUP BY c.manager_id`,
    )
    .all(p.from, p.to) as { manager_id: number | null; v: number; vol: number; n: number }[];
  const expenses = db()
    .prepare(
      `SELECT e.*, m.name manager_name, cb.name created_by_name FROM expenses e LEFT JOIN users m ON m.id=e.manager_id LEFT JOIN users cb ON cb.id = e.created_by
       WHERE e.archived = 0 AND e.date >= ? AND e.date < ? ORDER BY e.date DESC`,
    )
    .all(p.from, p.to) as {
    id: number;
    date: number;
    category: string;
    description: string | null;
    amount_usd: number;
    manager_id: number | null;
    manager_name: string | null;
    created_by_name: string | null;
    is_sample: number;
  }[];
  const received = db()
    .prepare("SELECT COALESCE(SUM(usd_amount),0) v FROM payments WHERE status='verified' AND decided_at >= ? AND decided_at < ?")
    .get(p.from, p.to) as { v: number };

  const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0);
  const managers = db().prepare("SELECT id, name FROM users WHERE role='manager' ORDER BY name").all() as { id: number; name: string }[];
  const perManager = [...managers.map((m) => ({ id: m.id as number | null, name: m.name })), { id: null, name: "Agency (no manager)" }]
    .map((m) => {
      const s = accountSales.find((x) => x.manager_id === m.id);
      const f = fees.find((x) => x.manager_id === m.id);
      const e = sum(expenses.filter((x) => x.manager_id === m.id), (x) => x.amount_usd);
      const income = (s?.v ?? 0) + (f?.v ?? 0);
      return { ...m, accounts: s?.n ?? 0, sales: s?.v ?? 0, fees: f?.v ?? 0, volume: f?.vol ?? 0, expenses: e, income, profit: income - e };
    })
    .filter((m) => m.income || m.expenses);

  const byCategory: Record<string, number> = {};
  for (const e of expenses) byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount_usd;

  const salesTotal = sum(accountSales, (x) => x.v);
  const feesTotal = sum(fees, (x) => x.v);
  const expTotal = sum(expenses, (x) => x.amount_usd);
  return {
    salesTotal,
    feesTotal,
    income: salesTotal + feesTotal,
    expTotal,
    profit: salesTotal + feesTotal - expTotal,
    received: received.v,
    volume: sum(fees, (x) => x.vol),
    perManager,
    byCategory,
    expenses,
  };
}

/** Last N calendar months of income/expenses/profit (agency time zone). */
export function monthlyProfit(months = 6) {
  const today = ymd(Date.now());
  const out: { label: string; income: number; expenses: number; profit: number }[] = [];
  let [y, m] = today.split("-").map(Number);
  const list: { y: number; m: number }[] = [];
  for (let i = 0; i < months; i++) {
    list.unshift({ y, m });
    m--;
    if (m === 0) (m = 12), y--;
  }
  for (const { y, m } of list) {
    const from = tzMidnight(`${y}-${String(m).padStart(2, "0")}-01`);
    const ny = m === 12 ? y + 1 : y;
    const nm = m === 12 ? 1 : m + 1;
    const to = tzMidnight(`${ny}-${String(nm).padStart(2, "0")}-01`);
    const s = db().prepare("SELECT COALESCE(SUM(account_price),0) v FROM accounts WHERE decided_at >= ? AND decided_at < ? AND status != 'rejected'").get(from, to) as { v: number };
    const f = db().prepare("SELECT COALESCE(SUM(fee_amount),0) v FROM topups WHERE status='completed' AND decided_at >= ? AND decided_at < ?").get(from, to) as { v: number };
    const e = db().prepare("SELECT COALESCE(SUM(amount_usd),0) v FROM expenses WHERE archived=0 AND date >= ? AND date < ?").get(from, to) as { v: number };
    const label = new Date(Date.UTC(y, m - 1, 15)).toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
    out.push({ label, income: s.v + f.v, expenses: e.v, profit: s.v + f.v - e.v });
  }
  return out;
}
