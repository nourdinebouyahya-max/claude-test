import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Archive, RotateCcw, CheckCircle2 } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { ApiError } from "@/lib/auth";
import { clientPricing, defaultPricing, getClientFor, type ClientRow } from "@/lib/access";
import { accountsForClient, listActivity, listClients, listManagerBasics, paymentsForClient, topupsForClient } from "@/lib/queries";
import { PRICING_KEYS, pricingKeyLabel } from "@/lib/constants";
import { date, usd } from "@/lib/format";
import { db } from "@/lib/db";
import { CallButton } from "../client";
import { EditClientButton, NewAccountButton, NewClientButton, NewPaymentButton, NewTopupButton, ReassignClientButton } from "../buttons";
import { PricingEditor } from "../forms";
import { Card, Empty, PageHead, PlatformIcon, SampleTag, Stat } from "../ui";
import { Filters, Timeline, exportHref, formContext, type SP } from "./common";
import { AccountsTable } from "./accounts";
import { TopupsTable } from "./topups";
import { PaymentsTable } from "./payments";

export function ClientsView({ user, base, sp }: { user: SessionUser; base: string; sp: SP }) {
  const isAdmin = user.role === "admin";
  const rows = listClients(user, sp);
  const managers = isAdmin ? listManagerBasics() : undefined;
  const totalVolume = rows.reduce((s, r) => s + r.volume, 0);
  const review = rows.filter((r) => r.needs_review).length;
  return (
    <>
      <PageHead title={isAdmin ? "Clients" : "My Clients"} sub={isAdmin ? "Every client, their manager and performance." : "Clients assigned to you."}>
        <a className="btn" href={exportHref("clients", sp)}>
          <Download /> CSV
        </a>
        <NewClientButton managers={managers?.filter((m) => m.status === "active")} goTo={`${base}/clients`} />
      </PageHead>
      <div className="stats">
        <Stat label="Clients" value={rows.length} sub={sp.status === "archived" ? "archived" : "in this view"} />
        <Stat label="Active accounts" value={rows.reduce((s, r) => s + r.active_accounts, 0)} />
        <Stat label="Top-up volume" value={usd(totalVolume)} tone="accent" sub="all time, completed" />
        <Stat label="Fees" value={usd(rows.reduce((s, r) => s + r.fees, 0))} tone="accent" />
        {isAdmin && (
          <Stat label="Needs review" value={review} tone={review ? "warn" : undefined} sub={<Link href="/admin/clients?review=1">Show only these</Link>} />
        )}
      </div>
      <section className="card">
        <Filters
          sp={sp}
          base={base + "/clients"}
          managers={managers}
          statuses={[
            { value: "active", label: "Active" },
            { value: "archived", label: "Archived" },
            { value: "all", label: "All" },
          ]}
          extra={
            isAdmin ? (
              <div className="field" style={{ width: 150 }}>
                <label>Review</label>
                <select className="input" name="review" defaultValue={sp.review ?? ""}>
                  <option value="">All</option>
                  <option value="1">Needs review</option>
                </select>
              </div>
            ) : undefined
          }
        />
        {rows.length === 0 ? (
          <Empty>No clients yet. Add your first client.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Contact</th>
                  {isAdmin && <th>Manager</th>}
                  <th>Platforms</th>
                  <th className="num">Accounts</th>
                  <th className="num">Top-up volume</th>
                  <th className="num">Fees</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td style={{ minWidth: 200 }}>
                      <Link className="bold" href={`${base}/clients/${c.id}`}>
                        {c.business_name}
                      </Link>{" "}
                      <SampleTag show={c.is_sample} />
                      {!!c.needs_review && isAdmin && <span className="tag review">Needs review</span>}
                      {c.status === "archived" && <span className="tag">Archived</span>}
                      {c.markets && <div className="xs muted ellipsis" style={{ maxWidth: 260 }}>{c.markets}</div>}
                    </td>
                    <td className="small">
                      <div>{c.contact_name ?? "—"}</div>
                      <div className="muted">{c.phone ?? c.email}</div>
                    </td>
                    {isAdmin && <td>{c.manager_id ? <Link href={`/admin/managers/${c.manager_id}`}>{c.manager_name}</Link> : <span className="pill amber">Unassigned</span>}</td>}
                    <td>
                      <span className="row" style={{ gap: 4 }}>
                        {(c.platforms ?? "").split(",").filter(Boolean).map((p) => (
                          <PlatformIcon key={p} platform={p} />
                        ))}
                        {!c.platforms && <span className="muted">—</span>}
                      </span>
                    </td>
                    <td className="num">
                      {c.active_accounts} <span className="muted">/ {c.accounts}</span>
                    </td>
                    <td className="num bold">{usd(c.volume)}</td>
                    <td className="num">{usd(c.fees)}</td>
                    <td className="small nowrap">
                      {date(c.created_at)}
                      <div className="xs muted">by {c.created_by_name ?? "—"}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export function ClientProfile({ user, base, id, tab }: { user: SessionUser; base: string; id: number; tab?: string }) {
  let c: ClientRow;
  try {
    c = getClientFor(user, id);
  } catch (e) {
    if (e instanceof ApiError) notFound();
    throw e;
  }
  const isAdmin = user.role === "admin";
  const manager = c.manager_id ? (db().prepare("SELECT id, name, email, phone FROM users WHERE id = ?").get(c.manager_id) as { id: number; name: string; email: string; phone: string | null }) : null;
  const creator = c.created_by ? (db().prepare("SELECT name FROM users WHERE id = ?").get(c.created_by) as { name: string } | undefined) : undefined;
  const accounts = accountsForClient(c.id);
  const topups = topupsForClient(c.id);
  const payments = paymentsForClient(c.id);
  const pricing = clientPricing(c.id);
  const timeline = listActivity({ client: c.id, limit: 500 });
  const ctx = formContext(user);
  const done = topups.filter((t) => t.status === "completed");
  const volume = done.reduce((s, t) => s + t.usd_amount, 0);
  const fees = done.reduce((s, t) => s + t.fee_amount, 0);
  const paid = payments.filter((p) => p.status === "verified").reduce((s, p) => s + p.usd_amount, 0);
  const accountSales = accounts.filter((a) => a.decided_at && a.status !== "rejected").reduce((s, a) => s + a.account_price, 0);
  const t = tab ?? (isAdmin && c.needs_review ? "pricing" : "accounts");
  const managers = isAdmin ? listManagerBasics().filter((m) => m.status === "active") : [];
  const active = c.status === "active";
  const tabLink = (k: string, label: string, n?: number) => (
    <Link className={t === k ? "on" : ""} href={`${base}/clients/${c.id}?tab=${k}`} scroll={false}>
      {label}
      {n != null && <span className="muted"> {n}</span>}
    </Link>
  );

  return (
    <>
      <PageHead
        title={
          <span className="row-wrap">
            {c.business_name} <SampleTag show={c.is_sample} />
            {!!c.needs_review && <span className="tag review">Needs review</span>}
            {!active && <span className="tag">Archived</span>}
          </span>
        }
        sub={
          <>
            Client #{c.id} · added {date(c.created_at)} by {creator?.name ?? "—"} ({c.created_by_role}) · manager{" "}
            {manager ? isAdmin ? <Link href={`/admin/managers/${manager.id}`}>{manager.name}</Link> : manager.name : "unassigned"}
          </>
        }
      >
        {active && (
          <>
            <NewAccountButton clients={ctx.clients} pricing={ctx.pricing} defaultClient={c.id} className="btn" />
            <NewTopupButton clients={ctx.clients} accounts={ctx.activeAccounts} methods={ctx.methods} pricing={ctx.pricing} fx={ctx.fx} min={ctx.min} defaultClient={c.id} className="btn" />
            <NewPaymentButton clients={ctx.clients} accounts={ctx.allAccounts} methods={ctx.methods} fx={ctx.fx} defaultClient={c.id} className="btn" />
          </>
        )}
      </PageHead>

      {isAdmin && !!c.needs_review && (
        <div className="banner">
          <CheckCircle2 size={18} /> Added by a manager — check the details and confirm pricing in the Pricing tab.
          <span className="grow" />
          <CallButton url={`/api/clients/${c.id}`} body={{ action: "review" }} label="Mark reviewed (keep default pricing)" className="btn sm primary" done="Client reviewed" />
        </div>
      )}

      <div className="stats">
        <Stat label="Active accounts" value={accounts.filter((a) => a.status === "active").length} sub={`${accounts.length} total`} />
        <Stat label="Top-up volume" value={usd(volume)} tone="accent" sub={`${done.length} completed`} />
        <Stat label="Fees" value={usd(fees)} tone="accent" />
        <Stat label="Total spent" value={usd(volume + accountSales)} sub="top-ups + account purchases" />
        <Stat label="Payments verified" value={usd(paid)} />
      </div>

      <div className="grid grid-side">
        <section className="card" style={{ minWidth: 0 }}>
          <div className="tabs">
            {tabLink("accounts", "Ad accounts", accounts.length)}
            {tabLink("topups", "Top-ups", topups.length)}
            {tabLink("payments", "Payments", payments.length)}
            {tabLink("pricing", "Pricing")}
            {tabLink("history", "History", timeline.length)}
          </div>
          {t === "accounts" && <AccountsTable rows={accounts} base={base} showClient={false} />}
          {t === "topups" && <TopupsTable rows={topups} base={base} showClient={false} />}
          {t === "payments" && <PaymentsTable rows={payments} base={base} showClient={false} />}
          {t === "pricing" &&
            (isAdmin ? (
              <div style={{ paddingBottom: 16 }}>
                <p className="small muted" style={{ padding: "12px 16px 0", margin: 0 }}>Account price and top-up fee per platform for this client. Only the admin can change these.</p>
                <PricingEditor url={`/api/clients/${c.id}/pricing`} values={pricing} defaults={defaultPricing()} confirmReview={!!c.needs_review} />
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Platform</th>
                    <th className="num">Account price</th>
                    <th className="num">Top-up fee</th>
                  </tr>
                </thead>
                <tbody>
                  {PRICING_KEYS.map((k) => (
                    <tr key={k}>
                      <td>
                        <span className="plat"><PlatformIcon platform={k.split(":")[0]} /> {pricingKeyLabel(k)}</span>
                      </td>
                      <td className="num bold">{usd(pricing[k].price)}</td>
                      <td className="num">{pricing[k].fee}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          {t === "history" && (
            <div className="card-body">
              <Timeline rows={timeline} />
            </div>
          )}
        </section>

        <div className="stack">
          <Card
            title="Contact"
            actions={
              <>
                {active && (
                  <EditClientButton
                    initial={{ id: c.id, business_name: c.business_name, contact_name: c.contact_name, phone: c.phone, email: c.email, website: c.website, markets: c.markets, notes: c.notes }}
                  />
                )}
                {active ? (
                  <CallButton url={`/api/clients/${c.id}`} body={{ action: "archive" }} label="Archive" icon={<Archive size={14} />} className="btn sm" confirm="Archive this client? It stays in the history and can be restored." done="Client archived" />
                ) : (
                  <CallButton url={`/api/clients/${c.id}`} body={{ action: "unarchive" }} label="Restore" icon={<RotateCcw size={14} />} className="btn sm" done="Client restored" />
                )}
              </>
            }
          >
            <dl className="kv">
              <dt>Contact</dt>
              <dd>{c.contact_name ?? "—"}</dd>
              <dt>Phone</dt>
              <dd>{c.phone ? <a href={`https://wa.me/${c.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener">{c.phone}</a> : "—"}</dd>
              <dt>Email</dt>
              <dd>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : "—"}</dd>
              <dt>Website</dt>
              <dd>{c.website ? <a href={c.website} target="_blank" rel="noopener noreferrer">{c.website.replace(/^https?:\/\//, "")}</a> : "—"}</dd>
              <dt>Markets</dt>
              <dd>{c.markets ?? "—"}</dd>
              <dt>Notes</dt>
              <dd style={{ whiteSpace: "pre-wrap" }}>{c.notes ?? "—"}</dd>
            </dl>
          </Card>

          {isAdmin && (
            <Card title="Manager" actions={<ReassignClientButton clientId={c.id} managers={managers} current={c.manager_id} />}>
              {manager ? (
                <dl className="kv">
                  <dt>Name</dt>
                  <dd><Link href={`/admin/managers/${manager.id}`}>{manager.name}</Link></dd>
                  <dt>Email</dt>
                  <dd>{manager.email}</dd>
                  <dt>Phone</dt>
                  <dd>{manager.phone ?? "—"}</dd>
                </dl>
              ) : (
                <div className="warn-box">No manager assigned.</div>
              )}
            </Card>
          )}

          {t !== "history" && (
            <Card title="Latest activity" actions={<Link className="small" href={`${base}/clients/${c.id}?tab=history`}>Full timeline</Link>}>
              <Timeline rows={timeline.slice(0, 6)} />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

