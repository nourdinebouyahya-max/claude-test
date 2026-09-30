import Link from "next/link";
import { Archive } from "lucide-react";
import { requirePageUser } from "@/lib/auth";
import { finance, monthlyProfit } from "@/lib/metrics";
import { parsePeriod } from "@/lib/period";
import { listManagerBasics } from "@/lib/queries";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { date, usd, ymd } from "@/lib/format";
import { CallButton } from "@/components/client";
import { NewExpenseButton } from "@/components/buttons";
import { HBars } from "@/components/charts";
import { Card, Empty, PageHead, SampleTag, Stat } from "@/components/ui";
import { PeriodPicker } from "@/components/views/period";

export const metadata = { title: "Finance" };

export default async function Finance({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requirePageUser("admin");
  const p = parsePeriod(await searchParams, "month");
  const f = finance(p);
  const months = monthlyProfit(6);
  const managers = listManagerBasics();
  return (
    <>
      <PageHead title="Finance" sub={`Income = account sales + top-up fees · ${p.label}`}>
        <PeriodPicker p={p} />
        <NewExpenseButton managers={managers} today={ymd(Date.now())} />
      </PageHead>
      <div className="stats">
        <Stat label="Account sales" value={usd(f.salesTotal)} />
        <Stat label="Top-up fees" value={usd(f.feesTotal)} sub={`on ${usd(f.volume)} volume`} />
        <Stat label="Income" value={usd(f.income)} tone="accent" />
        <Stat label="Expenses" value={usd(f.expTotal)} tone="warn" />
        <Stat label="Profit" value={usd(f.profit)} tone={f.profit >= 0 ? "accent" : "danger"} />
        <Stat label="Payments received" value={usd(f.received)} sub="verified" />
      </div>
      <div className="stack">
        <div className="grid grid-2">
          <Card title="Profit per manager" sub="Income from their clients minus expenses linked to them" pad={false}>
            {f.perManager.length === 0 ? (
              <Empty>No income or expenses in this period.</Empty>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Manager</th>
                      <th className="num">Accounts</th>
                      <th className="num">Sales</th>
                      <th className="num">Fees</th>
                      <th className="num">Expenses</th>
                      <th className="num">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.perManager.map((m) => (
                      <tr key={m.id ?? "agency"}>
                        <td>{m.id ? <Link href={`/admin/managers/${m.id}`}>{m.name}</Link> : <span className="muted">{m.name}</span>}</td>
                        <td className="num">{m.accounts}</td>
                        <td className="num">{usd(m.sales)}</td>
                        <td className="num">{usd(m.fees)}</td>
                        <td className="num">{usd(m.expenses)}</td>
                        <td className="num bold" style={{ color: m.profit < 0 ? "var(--red-fg)" : "var(--primary-ink)" }}>{usd(m.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card title="Last 6 months" pad={false}>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="num">Income</th>
                    <th className="num">Expenses</th>
                    <th className="num">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m) => (
                    <tr key={m.label}>
                      <td>{m.label}</td>
                      <td className="num">{usd(m.income)}</td>
                      <td className="num">{usd(m.expenses)}</td>
                      <td className="num bold" style={{ color: m.profit < 0 ? "var(--red-fg)" : "var(--primary-ink)" }}>{usd(m.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
        <div className="grid grid-side">
          <Card title="Expenses" sub={p.label} pad={false}>
            {f.expenses.length === 0 ? (
              <Empty>No expenses recorded in this period.</Empty>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Manager</th>
                      <th className="num">Amount</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.expenses.map((e) => (
                      <tr key={e.id}>
                        <td className="nowrap small">{date(e.date)}</td>
                        <td>{EXPENSE_CATEGORIES[e.category as keyof typeof EXPENSE_CATEGORIES] ?? e.category}</td>
                        <td>
                          {e.description ?? "—"} <SampleTag show={e.is_sample} />
                        </td>
                        <td>{e.manager_name ?? <span className="muted">Agency</span>}</td>
                        <td className="num bold">{usd(e.amount_usd, 2)}</td>
                        <td className="actions">
                          <CallButton url={`/api/expenses/${e.id}`} label="" icon={<Archive size={13} />} className="btn xs ghost" confirm="Archive this expense? It will no longer count in finance." done="Expense archived" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card title="Expenses by category">
            <HBars data={Object.entries(f.byCategory).map(([k, v]) => ({ key: k, label: EXPENSE_CATEGORIES[k as keyof typeof EXPENSE_CATEGORIES] ?? k, value: v }))} empty="No expenses" />
          </Card>
        </div>
      </div>
    </>
  );
}
