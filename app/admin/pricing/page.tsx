import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { defaultPricing } from "@/lib/access";
import { pricingKeyLabel } from "@/lib/constants";
import { Card, PageHead, Empty } from "@/components/ui";
import { PricingEditor } from "@/components/forms";

export const metadata = { title: "Pricing" };

export default async function Pricing() {
  await requirePageUser("admin");
  const defs = defaultPricing();
  const overrides = db()
    .prepare(
      `SELECT p.client_id, c.business_name, p.key, p.account_price, p.fee_pct, d.account_price def_price, d.fee_pct def_fee
       FROM pricing p JOIN clients c ON c.id = p.client_id JOIN pricing d ON d.client_id = 0 AND d.key = p.key
       WHERE p.client_id != 0 AND c.status = 'active' AND (p.account_price != d.account_price OR p.fee_pct != d.fee_pct)
       ORDER BY c.business_name, p.key`,
    )
    .all() as { client_id: number; business_name: string; key: string; account_price: number; fee_pct: number; def_price: number; def_fee: number }[];
  return (
    <>
      <PageHead title="Pricing" sub="Default account prices and top-up fees. Applied to every new client; existing clients keep their own prices." />
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Agency defaults</h2>
              <p>Changing these does not reprice existing clients.</p>
            </div>
          </div>
          <div style={{ paddingBottom: 16 }}>
            <PricingEditor url="/api/pricing" values={defs} />
          </div>
        </section>
        <Card title={`Per-client overrides (${overrides.length})`} sub="Clients whose price or fee differs from the current default. Edit them from the client page." pad={false}>
          {overrides.length === 0 ? (
            <Empty>Every client is on the default pricing.</Empty>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Platform</th>
                  <th className="num">Client</th>
                  <th className="num">Default</th>
                </tr>
              </thead>
              <tbody>
                {overrides.map((o) => (
                  <tr key={`${o.client_id}-${o.key}`}>
                    <td><Link href={`/admin/clients/${o.client_id}`}>{o.business_name}</Link></td>
                    <td>{pricingKeyLabel(o.key)}</td>
                    <td className="num bold">${o.account_price} · {o.fee_pct}%</td>
                    <td className="num muted">${o.def_price} · {o.def_fee}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
