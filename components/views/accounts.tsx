import Link from "next/link";
import { Download } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { listAccounts, listManagerBasics, type AccountRow } from "@/lib/queries";
import { ACCOUNT_STATUSES, OPEN_ACCOUNT } from "@/lib/constants";
import { dateTime, duration, usd } from "@/lib/format";
import { ItemActions } from "../client";
import { NewAccountButton } from "../buttons";
import { Empty, PageHead, PlatformName, SampleTag, Stat, StatusPill, Waiting } from "../ui";
import { Filters, exportHref, formContext, type SP } from "./common";

const DETAIL_LABEL: Record<string, string> = {
  bm_id: "Business Manager ID",
  pages: "Facebook pages",
  website: "Website",
  google_email: "Google email",
  mcc_id: "MCC ID",
  bc_id: "Business Center ID",
  share_email: "Share with",
  org_id: "Organization ID",
  snap_email: "Snapchat email",
};

export function AccountDetails({ a }: { a: AccountRow }) {
  let d: Record<string, string | string[]> = {};
  try {
    d = JSON.parse(a.details);
  } catch {}
  return (
    <details>
      <summary className="xs muted" style={{ cursor: "pointer" }}>Request details</summary>
      <dl className="kv small" style={{ gridTemplateColumns: "130px 1fr", marginTop: 6 }}>
        {Object.entries(d)
          .filter(([, v]) => (Array.isArray(v) ? v.length : v))
          .map(([k, v]) => (
            <div key={k} style={{ display: "contents" }}>
              <dt>{DETAIL_LABEL[k] ?? k}</dt>
              <dd className={k.endsWith("_id") ? "mono" : ""}>{Array.isArray(v) ? v.map((x) => <div key={x}>{x}</div>) : v}</dd>
            </div>
          ))}
        <dt>Time zone</dt>
        <dd>{a.timezone}</dd>
        {a.notes && (
          <>
            <dt>Notes</dt>
            <dd>{a.notes}</dd>
          </>
        )}
        <dt>Created by</dt>
        <dd>{a.created_by_name ?? "—"}</dd>
      </dl>
    </details>
  );
}

export function AccountsTable({ rows, base, showManager, showClient = true }: { rows: AccountRow[]; base: string; showManager?: boolean; showClient?: boolean }) {
  if (!rows.length) return <Empty>No ad accounts match.</Empty>;
  const now = Date.now();
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Account</th>
            {showClient && <th>Client</th>}
            {showManager && <th>Manager</th>}
            <th>Platform</th>
            <th className="num">Price · fee</th>
            <th>Status</th>
            <th>Timing</th>
            <th className="num">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const open = OPEN_ACCOUNT.includes(a.status);
            return (
              <tr key={a.id}>
                <td style={{ minWidth: 220 }}>
                  <div className="bold">
                    {a.name} <SampleTag show={a.is_sample} />
                  </div>
                  <div className="xs muted mono">{a.ad_account_id ? `ID ${a.ad_account_id}` : "ID pending"} · #{a.id}</div>
                  <AccountDetails a={a} />
                </td>
                {showClient && (
                  <td>
                    <Link href={`${base}/clients/${a.client_id}`}>{a.client_name}</Link>
                  </td>
                )}
                {showManager && <td>{a.manager_id ? <Link href={`/admin/managers/${a.manager_id}`}>{a.manager_name}</Link> : <span className="muted">—</span>}</td>}
                <td>
                  <PlatformName platform={a.platform} origin={a.origin} />
                </td>
                <td className="num nowrap">
                  {usd(a.account_price)} · {a.fee_pct}%
                  {a.volume > 0 && <div className="xs muted">{usd(a.volume)} topped up</div>}
                </td>
                <td>
                  <StatusPill status={a.status} />
                  {a.reject_reason && <div className="xs" style={{ color: "var(--red-fg)", maxWidth: 220, marginTop: 4 }}>{a.reject_reason}</div>}
                </td>
                <td className="small nowrap">
                  <div>{dateTime(a.created_at)}</div>
                  {open ? (
                    <div className="row" style={{ gap: 4 }}>
                      <span className="xs muted">waiting</span> <Waiting since={a.status_at} now={now} />
                    </div>
                  ) : (
                    <div className="xs muted">
                      1st answer {duration(a.first_response_at ? a.first_response_at - a.created_at : null)} · done {duration(a.decided_at ? a.decided_at - a.created_at : null)}
                    </div>
                  )}
                  {a.handled_by_name && <div className="xs faint">by {a.handled_by_name}</div>}
                </td>
                <td className="actions">
                  <ItemActions kind="account" id={a.id} status={a.status} adAccountId={a.ad_account_id} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AccountsView({ user, base, sp }: { user: SessionUser; base: string; sp: SP }) {
  const rows = listAccounts(user, sp);
  const ctx = formContext(user);
  const isAdmin = user.role === "admin";
  const count = (s: string[]) => rows.filter((r) => s.includes(r.status)).length;
  return (
    <>
      <PageHead title="Ad Accounts" sub="Account requests and delivered ad accounts.">
        <a className="btn" href={exportHref("accounts", sp)}>
          <Download /> CSV
        </a>
        <NewAccountButton clients={ctx.clients} pricing={ctx.pricing} className="btn primary" />
      </PageHead>
      <div className="stats">
        <Stat label="Requested" value={count(["requested"])} tone={count(["requested"]) ? "warn" : undefined} />
        <Stat label="In progress" value={count(["in_progress"])} />
        <Stat label="Delivered" value={count(["delivered"])} sub="waiting activation" />
        <Stat label="Active" value={count(["active"])} tone="accent" />
        <Stat label="Rejected" value={count(["rejected"])} tone={count(["rejected"]) ? "danger" : undefined} />
      </div>
      <section className="card">
        <Filters
          sp={sp}
          base={base + "/accounts"}
          managers={isAdmin ? listManagerBasics() : undefined}
          clients={ctx.clients}
          statuses={["open", ...ACCOUNT_STATUSES]}
        />
        <AccountsTable rows={rows} base={base} showManager={isAdmin} />
      </section>
    </>
  );
}
