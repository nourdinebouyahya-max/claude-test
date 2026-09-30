import Link from "next/link";
import { Download } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { listManagerBasics, listTopups, type TopupRow } from "@/lib/queries";
import { OPEN_TOPUP, TOPUP_STATUSES } from "@/lib/constants";
import { dateTime, duration, money, usd, usd2 } from "@/lib/format";
import { ItemActions } from "../client";
import { NewTopupButton } from "../buttons";
import { BankLogo, Empty, PageHead, PlatformIcon, SampleTag, Stat, StatusPill, Waiting } from "../ui";
import { Filters, exportHref, formContext, type SP } from "./common";

export function TopupsTable({ rows, base, showManager, showClient = true }: { rows: TopupRow[]; base: string; showManager?: boolean; showClient?: boolean }) {
  if (!rows.length) return <Empty>No top-ups match.</Empty>;
  const now = Date.now();
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Top-up</th>
            {showClient && <th>Client</th>}
            {showManager && <th>Manager</th>}
            <th className="num">Paid</th>
            <th className="num">Fee</th>
            <th className="num">Net credited</th>
            <th>Method</th>
            <th>Status</th>
            <th>Timing</th>
            <th className="num">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td style={{ minWidth: 200 }}>
                <div className="row bold">
                  <PlatformIcon platform={t.platform} size={16} /> <span className="ellipsis" style={{ maxWidth: 260 }}>{t.account_name}</span> <SampleTag show={t.is_sample} />
                </div>
                <div className="xs muted">
                  #{t.id}
                  {t.ad_account_id && <span className="mono"> · {t.ad_account_id}</span>}
                  {t.reference && <> · ref {t.reference}</>}
                </div>
                {t.notes && <div className="xs muted">{t.notes}</div>}
              </td>
              {showClient && (
                <td>
                  <Link href={`${base}/clients/${t.client_id}`}>{t.client_name}</Link>
                </td>
              )}
              {showManager && <td>{t.manager_id ? <Link href={`/admin/managers/${t.manager_id}`}>{t.manager_name}</Link> : "—"}</td>}
              <td className="num nowrap">
                <div className="bold">{usd2(t.usd_amount)}</div>
                {t.currency !== "USD" && <div className="xs muted">{money(t.amount, t.currency)}</div>}
              </td>
              <td className="num nowrap">
                {usd2(t.fee_amount)}
                <div className="xs muted">{t.fee_pct}%</div>
              </td>
              <td className="num nowrap bold" style={{ color: "var(--primary-ink)" }}>{usd2(t.net_amount)}</td>
              <td>
                <span className="row small nowrap">
                  <BankLogo logo={t.method_logo} size={22} /> {t.method_name ?? "—"}
                </span>
              </td>
              <td>
                <StatusPill status={t.status} />
                {t.reject_reason && <div className="xs" style={{ color: "var(--red-fg)", maxWidth: 200, marginTop: 4 }}>{t.reject_reason}</div>}
              </td>
              <td className="small nowrap">
                <div>{dateTime(t.created_at)}</div>
                {OPEN_TOPUP.includes(t.status) ? (
                  <div className="row" style={{ gap: 4 }}>
                    <span className="xs muted">waiting</span> <Waiting since={t.status_at} now={now} />
                  </div>
                ) : (
                  <div className="xs muted">
                    1st answer {duration(t.first_response_at ? t.first_response_at - t.created_at : null)} · done {duration(t.decided_at ? t.decided_at - t.created_at : null)}
                  </div>
                )}
                {t.handled_by_name && <div className="xs faint">by {t.handled_by_name}</div>}
              </td>
              <td className="actions">
                <ItemActions kind="topup" id={t.id} status={t.status} proofUrl={t.proof_path ? `/api/files/topup/${t.id}` : null} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TopupsView({ user, base, sp }: { user: SessionUser; base: string; sp: SP }) {
  const rows = listTopups(user, sp);
  const ctx = formContext(user);
  const isAdmin = user.role === "admin";
  const done = rows.filter((r) => r.status === "completed");
  const sum = (a: TopupRow[], f: (t: TopupRow) => number) => a.reduce((s, x) => s + f(x), 0);
  const open = rows.filter((r) => OPEN_TOPUP.includes(r.status));
  return (
    <>
      <PageHead title="Top-ups" sub="Client payments credited to their ad accounts (fees deducted).">
        <a className="btn" href={exportHref("topups", sp)}>
          <Download /> CSV
        </a>
        <NewTopupButton clients={ctx.clients} accounts={ctx.activeAccounts} methods={ctx.methods} pricing={ctx.pricing} fx={ctx.fx} min={ctx.min} className="btn primary" />
      </PageHead>
      <div className="stats">
        <Stat label="Open" value={open.length} sub={usd(sum(open, (t) => t.usd_amount))} tone={open.length ? "warn" : undefined} />
        <Stat label="Proofs to check" value={rows.filter((r) => r.status === "requested").length} />
        <Stat label="Completed" value={done.length} sub="in this view" />
        <Stat label="Volume" value={usd(sum(done, (t) => t.usd_amount))} tone="accent" />
        <Stat label="Fees earned" value={usd(sum(done, (t) => t.fee_amount))} tone="accent" />
      </div>
      <section className="card">
        <Filters sp={sp} base={base + "/topups"} managers={isAdmin ? listManagerBasics() : undefined} clients={ctx.clients} statuses={["open", ...TOPUP_STATUSES]} />
        <TopupsTable rows={rows} base={base} showManager={isAdmin} />
      </section>
    </>
  );
}
