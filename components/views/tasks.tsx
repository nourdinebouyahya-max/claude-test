import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import { listTasks, listManagerBasics, clientOptions, type TaskRow } from "@/lib/queries";
import { dateTime, duration, usd } from "@/lib/format";
import { ItemActions } from "../client";
import { Empty, PlatformIcon, StatusPill, Waiting } from "../ui";
import { FilterForm } from "../client";
import type { SP } from "./common";

const KIND_LABEL = { account: "Account request", topup: "Top-up", payment: "Payment" };

export function TasksTable({ rows, base, showManager, view }: { rows: TaskRow[]; base: string; showManager?: boolean; view: string }) {
  if (!rows.length) return <Empty>{view === "open" ? "Nothing waiting — all caught up." : "No items."}</Empty>;
  const now = Date.now();
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>{view === "open" ? "Waiting" : "Created"}</th>
            <th>Item</th>
            <th>Client</th>
            {showManager && <th>Manager</th>}
            <th className="num">Amount</th>
            <th>Status</th>
            <th>Timing</th>
            <th className="num">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const open = !r.decided_at || ["requested", "in_progress", "delivered", "payment_received", "processing", "pending"].includes(r.status);
            return (
              <tr key={`${r.kind}-${r.id}`}>
                <td className="nowrap">{open ? <Waiting since={r.status_at} now={now} /> : <span className="small">{dateTime(r.created_at)}</span>}</td>
                <td style={{ minWidth: 220 }}>
                  <div className="xs muted" style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{KIND_LABEL[r.kind]} #{r.id}</div>
                  <div className="row bold">
                    {r.platform && <PlatformIcon platform={r.platform} size={16} />}
                    <span className="ellipsis" style={{ maxWidth: 300 }}>{r.title}</span>
                  </div>
                  {r.reject_reason && <div className="xs" style={{ color: "var(--red-fg)" }}>{r.reject_reason}</div>}
                </td>
                <td><Link href={`${base}/clients/${r.client_id}`}>{r.client_name}</Link></td>
                {showManager && <td>{r.manager_name ?? "—"}</td>}
                <td className="num">{r.amount != null ? usd(r.amount, 2) : "—"}</td>
                <td><StatusPill status={r.status} /></td>
                <td className="xs muted nowrap">
                  <div>received {dateTime(r.created_at)}</div>
                  <div>1st answer {r.first_response_at ? duration(r.first_response_at - r.created_at) : "—"}</div>
                  {r.decided_at && <div>completed {duration(r.decided_at - r.created_at)}</div>}
                </td>
                <td className="actions">
                  <ItemActions kind={r.kind} id={r.id} status={r.status} adAccountId={r.ad_account_id} proofUrl={r.proof_path ? `/api/files/${r.kind}/${r.id}` : null} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function TasksView({ user, base, sp }: { user: SessionUser; base: string; sp: SP }) {
  const view = sp.view === "closed" || sp.view === "all" ? sp.view : "open";
  const rows = listTasks(user, { ...sp, view });
  const isAdmin = user.role === "admin";
  const q = (v: string) => {
    const p = new URLSearchParams();
    for (const [k, val] of Object.entries(sp)) if (val && k !== "view") p.set(k, val);
    p.set("view", v);
    return `?${p}`;
  };
  return (
    <section className="card">
      <div className="card-head">
        <div className="seg">
          {(["open", "closed", "all"] as const).map((v) => (
            <Link key={v} href={q(v)} className={view === v ? "on" : ""} scroll={false}>
              {v[0].toUpperCase() + v.slice(1)}
            </Link>
          ))}
        </div>
        <FilterForm className="row-wrap">
          <input type="hidden" name="view" value={view} />
          {isAdmin && (
            <select className="input sm" name="manager" defaultValue={sp.manager ?? ""} style={{ width: 170 }}>
              <option value="">All managers</option>
              {listManagerBasics().map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}
          <select className="input sm" name="client" defaultValue={sp.client ?? ""} style={{ width: 190 }}>
            <option value="">All clients</option>
            {clientOptions(user, false).map((c) => (
              <option key={c.id} value={c.id}>{c.business_name}</option>
            ))}
          </select>
        </FilterForm>
      </div>
      <TasksTable rows={rows} base={base} showManager={isAdmin} view={view} />
    </section>
  );
}
