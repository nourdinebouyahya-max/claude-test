import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Archive } from "lucide-react";
import { managerKpis, type ManagerBadge, type ManagerKpi } from "@/lib/metrics";
import type { Period } from "@/lib/period";
import { db } from "@/lib/db";
import { listActivity, listManagerBasics } from "@/lib/queries";
import { OPEN_ACCOUNT, OPEN_PAYMENT, OPEN_TOPUP, PLATFORM_LABEL, type Platform } from "@/lib/constants";
import { ago, date, dateTime, duration, usd } from "@/lib/format";
import { CallButton, Toggle } from "../client";
import { EditManagerButton, NewManagerButton, ReassignAllButton, ResetPasswordButton } from "../buttons";
import { Avatar, Card, Empty, PageHead, PlatformIcon, SampleTag, Stat, StatusPill } from "../ui";
import { PeriodPicker } from "./period";
import { Timeline } from "./common";

const BADGE_TONE: Record<ManagerBadge, string> = { Working: "green", Quiet: "amber", Inactive: "gray", Overdue: "red" };
const BADGE_HINT: Record<ManagerBadge, string> = {
  Working: "Acted in the last 24h",
  Quiet: "Last action 1–3 days ago",
  Inactive: "No action for more than 3 days",
  Overdue: "Has an item waiting more than 24h",
};

export function BadgePill({ badge, disabled }: { badge: ManagerBadge; disabled?: boolean }) {
  if (disabled) return <span className="pill red" title="Login turned off">Access off</span>;
  return (
    <span className={`pill ${BADGE_TONE[badge]}`} title={BADGE_HINT[badge]}>
      {badge}
    </span>
  );
}

export function ManagersView({ p }: { p: Period }) {
  const rows = managerKpis(p);
  const sum = (f: (m: ManagerKpi) => number) => rows.reduce((s, m) => s + f(m), 0);
  return (
    <>
      <PageHead title="Managers" sub={`What each manager is doing · ${p.label}`}>
        <PeriodPicker p={p} />
        <NewManagerButton />
      </PageHead>
      <div className="stats">
        <Stat label="Managers" value={rows.length} sub={`${rows.filter((r) => r.status === "active").length} with access on`} />
        <Stat label="Working now" value={rows.filter((r) => r.badge === "Working" && r.status === "active").length} tone="accent" />
        <Stat label="Overdue managers" value={rows.filter((r) => r.badge === "Overdue").length} tone={rows.some((r) => r.badge === "Overdue") ? "danger" : undefined} />
        <Stat label="Volume" value={usd(sum((m) => m.volume))} tone="accent" sub={p.label} />
        <Stat label="Fees generated" value={usd(sum((m) => m.fees))} tone="accent" sub={p.label} />
      </div>
      <section className="card">
        {rows.length === 0 ? (
          <Empty>No managers yet. Add your first manager.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table compact">
              <thead>
                <tr>
                  <th>Manager</th>
                  <th>Status</th>
                  <th className="num">Clients</th>
                  <th className="num">New</th>
                  <th className="num">Active accts</th>
                  <th className="num">Top-ups</th>
                  <th className="num">Volume</th>
                  <th className="num">Fees</th>
                  <th className="num">Open</th>
                  <th className="num">&gt; 24h</th>
                  <th className="num">1st answer</th>
                  <th className="num">Complete</th>
                  <th className="num">Rejections</th>
                  <th>Last activity</th>
                  <th>Login</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td style={{ minWidth: 190 }}>
                      <div className="row">
                        <Avatar name={m.name} />
                        <div>
                          <Link className="bold" href={`/admin/managers/${m.id}`}>{m.name}</Link> <SampleTag show={m.is_sample} />
                          <div className="xs muted">{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><BadgePill badge={m.badge} disabled={m.status !== "active"} /></td>
                    <td className="num">{m.clients}</td>
                    <td className="num">{m.new_clients}</td>
                    <td className="num">{m.active_accounts}</td>
                    <td className="num">{m.topups}</td>
                    <td className="num bold">{usd(m.volume)}</td>
                    <td className="num">{usd(m.fees)}</td>
                    <td className="num">{m.open_items}</td>
                    <td className="num" style={{ color: m.overdue_items ? "var(--red-fg)" : undefined, fontWeight: m.overdue_items ? 700 : undefined }}>
                      {m.overdue_items ? <span className="row" style={{ justifyContent: "flex-end", gap: 4 }}><AlertTriangle size={13} />{m.overdue_items}</span> : 0}
                    </td>
                    <td className="num nowrap">{duration(m.avg_first_ms)}</td>
                    <td className="num nowrap">{duration(m.avg_complete_ms)}</td>
                    <td className="num">{m.rejections}</td>
                    <td className="small nowrap">{ago(m.last_activity)}</td>
                    <td>
                      <Toggle on={m.status === "active"} url={`/api/managers/${m.id}`} body={{ action: m.status === "active" ? "disable" : "enable" }} label={m.status === "active" ? "Turn login off" : "Turn login on"} />
                    </td>
                    <td>
                      <Link className="btn xs" href={`/admin/managers/${m.id}`}>Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="xs muted" style={{ marginTop: 10 }}>
        Working = action in the last 24h · Quiet = 1–3 days · Inactive = more than 3 days · Overdue = an item has been waiting more than 24h. Times are averages over requests in the period.
      </p>
    </>
  );
}

type Handled = {
  kind: "account" | "topup" | "payment";
  id: number;
  client_id: number;
  client_name: string;
  title: string;
  platform: string | null;
  amount: number | null;
  status: string;
  reject_reason: string | null;
  created_at: number;
  first_response_at: number | null;
  decided_at: number | null;
  handled_by_name: string | null;
};

export function ManagerProfile({ id, p, sp }: { id: number; p: Period; sp: Record<string, string | undefined> }) {
  const m = managerKpis(p, id)[0];
  if (!m) notFound();
  const clients = db()
    .prepare(
      `SELECT c.id, c.business_name, c.status, c.is_sample, c.needs_review,
        (SELECT COUNT(*) FROM accounts a WHERE a.client_id=c.id AND a.status='active') active_accounts,
        (SELECT COALESCE(SUM(usd_amount),0) FROM topups t WHERE t.client_id=c.id AND t.status='completed' AND t.decided_at >= ? AND t.decided_at < ?) volume,
        (SELECT COALESCE(SUM(usd_amount),0) FROM topups t WHERE t.client_id=c.id AND t.status='completed') volume_all
       FROM clients c WHERE c.manager_id = ? ORDER BY volume DESC, c.business_name`,
    )
    .all(p.from, p.to, id) as { id: number; business_name: string; status: string; is_sample: number; needs_review: number; active_accounts: number; volume: number; volume_all: number }[];

  const handled = db()
    .prepare(
      `SELECT * FROM (
        SELECT 'account' kind, a.id, a.client_id, c.business_name client_name, a.name title, a.platform, a.account_price amount, a.status, a.reject_reason, a.created_at, a.first_response_at, a.decided_at, h.name handled_by_name
        FROM accounts a JOIN clients c ON c.id=a.client_id LEFT JOIN users h ON h.id=a.handled_by WHERE (c.manager_id = @id OR a.handled_by = @id) AND a.created_at >= @from AND a.created_at < @to
        UNION ALL
        SELECT 'topup', t.id, t.client_id, c.business_name, 'Top-up · ' || a.name, a.platform, t.usd_amount, t.status, t.reject_reason, t.created_at, t.first_response_at, t.decided_at, h.name
        FROM topups t JOIN clients c ON c.id=t.client_id JOIN accounts a ON a.id=t.account_id LEFT JOIN users h ON h.id=t.handled_by WHERE (c.manager_id = @id OR t.handled_by = @id) AND t.created_at >= @from AND t.created_at < @to
        UNION ALL
        SELECT 'payment', pm.id, pm.client_id, c.business_name, 'Payment', NULL, pm.usd_amount, pm.status, pm.reject_reason, pm.created_at, pm.first_response_at, pm.decided_at, h.name
        FROM payments pm JOIN clients c ON c.id=pm.client_id LEFT JOIN users h ON h.id=pm.handled_by WHERE (c.manager_id = @id OR pm.handled_by = @id) AND pm.created_at >= @from AND pm.created_at < @to
      ) ORDER BY created_at DESC LIMIT 500`,
    )
    .all({ id, from: p.from, to: p.to }) as Handled[];

  const expanded = sp.item; // "kind-id" whose history is shown
  const itemHistory = expanded
    ? listActivity({ entity: { type: expanded.split("-")[0], id: Number(expanded.split("-")[1]) }, limit: 100 })
    : [];
  const managers = listManagerBasics().filter((x) => x.id !== id && x.status === "active");
  const OPEN = [...OPEN_ACCOUNT, ...OPEN_TOPUP, ...OPEN_PAYMENT];
  const q = (item?: string) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v && k !== "item") s.set(k, v);
    if (item) s.set("item", item);
    return `?${s}`;
  };

  return (
    <>
      <PageHead
        title={
          <span className="row-wrap">
            <Avatar name={m.name} /> {m.name} <BadgePill badge={m.badge} disabled={m.status !== "active"} /> <SampleTag show={m.is_sample} />
          </span>
        }
        sub={`${m.email}${m.phone ? ` · ${m.phone}` : ""} · manager since ${date(m.created_at)} · last activity ${ago(m.last_activity)}`}
      >
        <EditManagerButton initial={{ id: m.id, name: m.name, email: m.email, phone: m.phone }} />
        <ResetPasswordButton id={m.id} />
        <CallButton
          url={`/api/managers/${m.id}`}
          body={{ action: m.status === "active" ? "disable" : "enable" }}
          label={m.status === "active" ? "Disable login" : "Enable login"}
          className={`btn sm ${m.status === "active" ? "danger" : "primary"}`}
          confirm={m.status === "active" ? "Turn off this manager's access? They are signed out immediately." : undefined}
          done={m.status === "active" ? "Access turned off" : "Access turned on"}
        />
        {clients.length > 0 && <ReassignAllButton managerId={m.id} managers={managers} />}
        {clients.filter((c) => c.status === "active").length === 0 && (
          <CallButton url={`/api/managers/${m.id}`} body={{ action: "archive" }} label="Archive" icon={<Archive size={14} />} className="btn sm" confirm="Archive this manager? Their history is kept." done="Manager archived" />
        )}
      </PageHead>
      <div style={{ marginBottom: 16 }}>
        <PeriodPicker p={p} />
      </div>
      <div className="stats">
        <Stat label="Clients" value={m.clients} sub={`${m.new_clients} new`} />
        <Stat label="Active accounts" value={m.active_accounts} />
        <Stat label="Top-ups" value={m.topups} sub={usd(m.volume)} tone="accent" />
        <Stat label="Fees generated" value={usd(m.fees)} tone="accent" />
        <Stat label="Open items" value={m.open_items} sub={`${m.overdue_items} waiting > 24h`} tone={m.overdue_items ? "danger" : undefined} />
        <Stat label="Avg 1st answer" value={duration(m.avg_first_ms)} />
        <Stat label="Avg to complete" value={duration(m.avg_complete_ms)} />
        <Stat label="Rejections" value={m.rejections} tone={m.rejections ? "warn" : undefined} />
      </div>

      <div className="stack">
        <div className="grid grid-2" style={{ alignItems: "start" }}>
            <Card title={`Clients (${clients.length})`} sub={`Volume in ${p.label.toLowerCase()}`} pad={false}>
              {clients.length === 0 ? (
                <Empty>No clients assigned.</Empty>
              ) : (
                <table className="table">
                  <tbody>
                    {clients.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <Link className="bold" href={`/admin/clients/${c.id}`}>{c.business_name}</Link> <SampleTag show={c.is_sample} />
                          {c.status === "archived" && <span className="tag">Archived</span>}
                          {!!c.needs_review && <span className="tag review">Review</span>}
                          <div className="xs muted">{c.active_accounts} active account(s) · {usd(c.volume_all)} all time</div>
                        </td>
                        <td className="num bold">{usd(c.volume)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
            <Card title="Recent actions">
              <Timeline rows={listActivity({ user: id, limit: 8 })} showClient base="/admin" />
            </Card>
        </div>
        <Card title={`Requests handled (${handled.length})`} sub={`Created in ${p.label.toLowerCase()} · click a row's History to see every action`} pad={false}>
          {handled.length === 0 ? (
            <Empty>No requests in this period.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Received</th>
                    <th>1st answer</th>
                    <th>Completed</th>
                    <th>Final status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {handled.map((h) => {
                    const key = `${h.kind}-${h.id}`;
                    const late = OPEN.includes(h.status) && Date.now() - h.created_at > 24 * 3600_000;
                    return (
                      <Fragment key={key}>
                      <tr style={expanded === key ? { background: "var(--primary-soft)" } : undefined}>
                        <td style={{ minWidth: 200 }}>
                          <div className="row bold">
                            {h.platform && <PlatformIcon platform={h.platform} size={15} />}
                            <span className="ellipsis" style={{ maxWidth: 260 }}>{h.title}</span>
                          </div>
                          <div className="xs muted">
                            <Link href={`/admin/clients/${h.client_id}`}>{h.client_name}</Link>
                            {h.amount != null && ` · ${usd(h.amount, 2)}`}
                            {h.platform && ` · ${PLATFORM_LABEL[h.platform as Platform]}`}
                            {h.handled_by_name && ` · by ${h.handled_by_name}`}
                          </div>
                          {h.reject_reason && <div className="xs" style={{ color: "var(--red-fg)" }}>Reason: {h.reject_reason}</div>}
                        </td>
                        <td className="small nowrap">{dateTime(h.created_at)}</td>
                        <td className="small nowrap">
                          {h.first_response_at ? (
                            <>
                              {dateTime(h.first_response_at)}
                              <div className="xs muted">after {duration(h.first_response_at - h.created_at)}</div>
                            </>
                          ) : (
                            <span className={late ? "pill red" : "muted"}>{late ? "no answer > 24h" : "—"}</span>
                          )}
                        </td>
                        <td className="small nowrap">
                          {h.decided_at ? (
                            <>
                              {dateTime(h.decided_at)}
                              <div className="xs muted">after {duration(h.decided_at - h.created_at)}</div>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td><StatusPill status={h.status} /></td>
                        <td>
                          <Link className="btn xs" href={expanded === key ? q() : q(key)} scroll={false}>
                            {expanded === key ? "Hide" : "History"}
                          </Link>
                        </td>
                      </tr>
                      {expanded === key && (
                        <tr>
                          <td colSpan={6} style={{ background: "var(--card-2)", paddingLeft: 28 }}>
                            <Timeline rows={itemHistory} />
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

