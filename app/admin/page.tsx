import Link from "next/link";
import { Briefcase, UserPlus, Megaphone, Clock, Wallet, DollarSign, PiggyBank, FileSearch, Ban, AlertTriangle } from "lucide-react";
import { requirePageUser } from "@/lib/auth";
import { adminOverview, managerKpis } from "@/lib/metrics";
import { parsePeriod } from "@/lib/period";
import { hasSamples, reviewCount } from "@/lib/queries";
import { ago, usd } from "@/lib/format";
import { BarChart, HBars } from "@/components/charts";
import { Card, PageHead, PlatformName, Stat } from "@/components/ui";
import { PeriodPicker } from "@/components/views/period";
import { BadgePill } from "@/components/views/managers";

export const metadata = { title: "Admin overview" };

export default async function AdminOverview({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requirePageUser("admin");
  const sp = await searchParams;
  const p = parsePeriod(sp, "30d");
  const o = adminOverview(p);
  const t = o.totals;
  const kpis = managerKpis(p);
  const review = reviewCount();
  return (
    <>
      <PageHead title="Overview" sub={`${p.label} · live, refreshes every 30s`}>
        <PeriodPicker p={p} />
      </PageHead>
      {hasSamples() && (
        <div className="banner">
          <span className="tag sample">Sample</span> Demo data is loaded so you can explore. Remove it any time from&nbsp;<Link href="/admin/settings">Settings</Link>
        </div>
      )}
      {(review > 0 || t.overdue > 0) && (
        <div className="row-wrap" style={{ marginBottom: 16 }}>
          {review > 0 && <Link className="pill amber" href="/admin/clients?review=1">{review} new client{review > 1 ? "s" : ""} to review</Link>}
          {t.overdue > 0 && <Link className="pill red" href="/admin/managers">{t.overdue} item{t.overdue > 1 ? "s" : ""} waiting &gt; 24h</Link>}
        </div>
      )}
      <div className="stats">
        <Stat label="Clients" value={t.clients} icon={<Briefcase />} />
        <Stat label="New clients" value={t.new_clients} icon={<UserPlus />} sub={p.label} />
        <Stat label="Active accounts" value={t.active_accounts} icon={<Megaphone />} />
        <Stat label="Open requests" value={t.open_requests} icon={<Clock />} tone={t.open_requests ? "warn" : undefined} />
        <Stat label="Top-ups" value={t.topups} icon={<Wallet />} sub="completed" />
        <Stat label="Top-up volume" value={usd(t.volume)} icon={<DollarSign />} tone="accent" />
        <Stat label="Fees earned" value={usd(t.fees)} icon={<PiggyBank />} tone="accent" />
        <Stat label="Pending proofs" value={t.pending_proofs} icon={<FileSearch />} tone={t.pending_proofs ? "warn" : undefined} />
        <Stat label="Rejected" value={t.rejected} icon={<Ban />} tone={t.rejected ? "danger" : undefined} sub={p.label} />
      </div>

      <div className="stack">
        <Card title="Top-up volume over time" sub={`Completed top-ups per day (USD) · total ${usd(t.volume)}`}>
          <BarChart data={o.series} />
        </Card>
        <div className="grid grid-3">
          <Card title="Volume by platform">
            <HBars data={o.platforms.map((x) => ({ key: x.label, label: <PlatformName platform={x.label} />, value: x.value }))} />
          </Card>
          <Card title="Volume by manager">
            <HBars data={o.managers} />
          </Card>
          <Card title="Top clients">
            <HBars data={o.topClients.map((c) => ({ key: c.id, label: <Link href={`/admin/clients/${c.id}`}>{c.label}</Link>, value: c.value }))} />
          </Card>
        </div>
        <Card title="Managers at a glance" actions={<Link className="btn sm" href="/admin/managers">All manager KPIs</Link>} pad={false}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Manager</th>
                  <th>Status</th>
                  <th className="num">Clients</th>
                  <th className="num">Volume</th>
                  <th className="num">Fees</th>
                  <th className="num">Open</th>
                  <th className="num">&gt; 24h</th>
                  <th>Last activity</th>
                </tr>
              </thead>
              <tbody>
                {kpis.map((m) => (
                  <tr key={m.id}>
                    <td><Link className="bold" href={`/admin/managers/${m.id}`}>{m.name}</Link></td>
                    <td><BadgePill badge={m.badge} disabled={m.status !== "active"} /></td>
                    <td className="num">{m.clients}</td>
                    <td className="num">{usd(m.volume)}</td>
                    <td className="num">{usd(m.fees)}</td>
                    <td className="num">{m.open_items}</td>
                    <td className="num" style={{ color: m.overdue_items ? "var(--red-fg)" : undefined, fontWeight: m.overdue_items ? 700 : undefined }}>
                      {m.overdue_items ? <span className="row" style={{ justifyContent: "flex-end", gap: 4 }}><AlertTriangle size={13} />{m.overdue_items}</span> : 0}
                    </td>
                    <td className="small">{ago(m.last_activity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}

