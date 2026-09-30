import Link from "next/link";
import { Download } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { listManagerBasics, listPayments, type PaymentRow } from "@/lib/queries";
import { PAYMENT_STATUSES } from "@/lib/constants";
import { dateTime, duration, money, usd, usd2 } from "@/lib/format";
import { ItemActions } from "../client";
import { NewPaymentButton } from "../buttons";
import { BankLogo, Empty, PageHead, SampleTag, Stat, StatusPill, Waiting } from "../ui";
import { Filters, exportHref, formContext, type SP } from "./common";

export function PaymentsTable({ rows, base, showManager, showClient = true }: { rows: PaymentRow[]; base: string; showManager?: boolean; showClient?: boolean }) {
  if (!rows.length) return <Empty>No payments match.</Empty>;
  const now = Date.now();
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Payment</th>
            {showClient && <th>Client</th>}
            {showManager && <th>Manager</th>}
            <th className="num">Amount</th>
            <th>Method</th>
            <th>Status</th>
            <th>Timing</th>
            <th className="num">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td style={{ minWidth: 180 }}>
                <div className="bold">
                  {p.purpose === "account_order" ? "Account order" : "General"} <SampleTag show={p.is_sample} />
                </div>
                <div className="xs muted">
                  #{p.id}
                  {p.account_name && <> · {p.account_name}</>}
                  {p.reference && <> · ref {p.reference}</>}
                </div>
                {p.notes && <div className="xs muted">{p.notes}</div>}
              </td>
              {showClient && (
                <td>
                  <Link href={`${base}/clients/${p.client_id}`}>{p.client_name}</Link>
                </td>
              )}
              {showManager && <td>{p.manager_id ? <Link href={`/admin/managers/${p.manager_id}`}>{p.manager_name}</Link> : "—"}</td>}
              <td className="num nowrap">
                <div className="bold">{usd2(p.usd_amount)}</div>
                {p.currency !== "USD" && <div className="xs muted">{money(p.amount, p.currency)}</div>}
              </td>
              <td>
                <span className="row small nowrap">
                  <BankLogo logo={p.method_logo} size={22} /> {p.method_name ?? "—"}
                </span>
              </td>
              <td>
                <StatusPill status={p.status} />
                {p.reject_reason && <div className="xs" style={{ color: "var(--red-fg)", maxWidth: 200, marginTop: 4 }}>{p.reject_reason}</div>}
              </td>
              <td className="small nowrap">
                <div>{dateTime(p.created_at)}</div>
                {p.status === "pending" ? (
                  <div className="row" style={{ gap: 4 }}>
                    <span className="xs muted">waiting</span> <Waiting since={p.status_at} now={now} />
                  </div>
                ) : (
                  <div className="xs muted">decided in {duration(p.decided_at ? p.decided_at - p.created_at : null)}</div>
                )}
                {p.handled_by_name && <div className="xs faint">by {p.handled_by_name}</div>}
              </td>
              <td className="actions">
                <ItemActions kind="payment" id={p.id} status={p.status} proofUrl={p.proof_path ? `/api/files/payment/${p.id}` : null} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PaymentsView({ user, base, sp }: { user: SessionUser; base: string; sp: SP }) {
  const rows = listPayments(user, sp);
  const ctx = formContext(user);
  const isAdmin = user.role === "admin";
  const sum = (s: string) => rows.filter((r) => r.status === s).reduce((a, r) => a + r.usd_amount, 0);
  return (
    <>
      <PageHead title="Payments" sub="Client payments for account orders and other services.">
        <a className="btn" href={exportHref("payments", sp)}>
          <Download /> CSV
        </a>
        <NewPaymentButton clients={ctx.clients} accounts={ctx.allAccounts} methods={ctx.methods} fx={ctx.fx} className="btn primary" />
      </PageHead>
      <div className="stats">
        <Stat label="Pending" value={rows.filter((r) => r.status === "pending").length} sub={usd(sum("pending"))} tone="warn" />
        <Stat label="Verified" value={rows.filter((r) => r.status === "verified").length} sub={usd(sum("verified"))} tone="accent" />
        <Stat label="Rejected" value={rows.filter((r) => r.status === "rejected").length} tone="danger" />
      </div>
      <section className="card">
        <Filters sp={sp} base={base + "/payments"} managers={isAdmin ? listManagerBasics() : undefined} clients={ctx.clients} statuses={[...PAYMENT_STATUSES]} />
        <PaymentsTable rows={rows} base={base} showManager={isAdmin} />
      </section>
    </>
  );
}
