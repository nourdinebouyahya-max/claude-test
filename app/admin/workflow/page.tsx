import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { listAccounts, listManagerBasics } from "@/lib/queries";
import { ACCOUNT_STATUSES, STATUS_LABEL, statusTone } from "@/lib/constants";
import { usd } from "@/lib/format";
import { ItemActions, FilterForm } from "@/components/client";
import { PageHead, PlatformName, SampleTag, Waiting } from "@/components/ui";
import { formContext } from "@/components/views/common";
import { NewAccountButton } from "@/components/buttons";

export const metadata = { title: "Workflow" };

export default async function Workflow({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePageUser("admin");
  const sp = await searchParams;
  const rows = listAccounts(user, { manager: sp.manager, platform: sp.platform });
  const cols = sp.all === "1" ? ACCOUNT_STATUSES : (["requested", "in_progress", "delivered", "active", "rejected"] as const);
  const now = Date.now();
  const ctx = formContext(user);
  return (
    <>
      <PageHead title="Workflow" sub="Account requests by status. Use the buttons on each card to move it forward.">
        <FilterForm className="row-wrap">
          <select className="input sm" name="manager" defaultValue={sp.manager ?? ""} style={{ width: 170 }}>
            <option value="">All managers</option>
            {listManagerBasics().map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <label className="check small">
            <input type="checkbox" name="all" value="1" defaultChecked={sp.all === "1"} /> Show suspended / replacement / closed
          </label>
        </FilterForm>
        <NewAccountButton clients={ctx.clients} pricing={ctx.pricing} className="btn primary" />
      </PageHead>
      <div className="kanban">
        {cols.map((s) => {
          const items = rows.filter((r) => r.status === s);
          const shown = s === "active" || s === "rejected" || s === "closed" ? items.slice(0, 30) : items;
          return (
            <div className="kcol" key={s}>
              <div className="kcol-head">
                <span className={`pill ${statusTone(s)}`}>{STATUS_LABEL[s]}</span>
                <span className="small muted bold">{items.length}</span>
              </div>
              {shown.map((a) => (
                <div className="kcard" key={a.id}>
                  <div className="between" style={{ gap: 6 }}>
                    <PlatformName platform={a.platform} origin={a.origin} size={16} />
                    {["requested", "in_progress", "delivered"].includes(s) && <Waiting since={a.status_at} now={now} />}
                  </div>
                  <Link href={`/admin/clients/${a.client_id}`} className="bold">{a.client_name}</Link>
                  <div className="xs muted">
                    {a.name.split(" · ").slice(1).join(" · ")} · {usd(a.account_price)} <SampleTag show={a.is_sample} />
                  </div>
                  <div className="xs muted">Manager: {a.manager_name ?? "—"}</div>
                  {a.ad_account_id && <div className="xs mono">ID {a.ad_account_id}</div>}
                  {a.reject_reason && <div className="xs" style={{ color: "var(--red-fg)" }}>{a.reject_reason}</div>}
                  <ItemActions kind="account" id={a.id} status={a.status} adAccountId={a.ad_account_id} />
                </div>
              ))}
              {items.length > shown.length && (
                <Link className="small" href={`/admin/accounts?status=${s}`}>+ {items.length - shown.length} more</Link>
              )}
              {items.length === 0 && <div className="xs faint" style={{ textAlign: "center", padding: 12 }}>Empty</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}
