import Link from "next/link";
import type { ReactNode } from "react";
import { FilterForm } from "../client";
import { PLATFORMS, PLATFORM_LABEL, STATUS_LABEL, statusTone } from "@/lib/constants";
import { dateTime } from "@/lib/format";
import type { LogRow } from "@/lib/queries";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { activeAccountOptions, clientOptions, fxRates, listMethods, minTopup } from "@/lib/queries";
import { clientPricing, clientScope } from "@/lib/access";

export type SP = Record<string, string | undefined>;

export function Filters({
  sp,
  base,
  managers,
  clients,
  statuses,
  platform = true,
  dates = true,
  search = true,
  extra,
}: {
  sp: SP;
  base: string;
  managers?: { id: number; name: string }[];
  clients?: { id: number; business_name: string }[];
  statuses?: readonly string[] | { value: string; label: string }[];
  platform?: boolean;
  dates?: boolean;
  search?: boolean;
  extra?: ReactNode;
}) {
  const hasAny = Object.entries(sp).some(([k, v]) => v && k !== "tab");
  return (
    <FilterForm>
      {search && (
        <div className="field wide">
          <label>Search</label>
          <input className="input" type="search" name="q" defaultValue={sp.q ?? ""} placeholder="Name, ID, reference…" />
        </div>
      )}
      {managers && (
        <div className="field">
          <label>Manager</label>
          <select className="input" name="manager" defaultValue={sp.manager ?? ""}>
            <option value="">All managers</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      )}
      {clients && (
        <div className="field">
          <label>Client</label>
          <select className="input" name="client" defaultValue={sp.client ?? ""}>
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.business_name}</option>
            ))}
          </select>
        </div>
      )}
      {platform && (
        <div className="field">
          <label>Platform</label>
          <select className="input" name="platform" defaultValue={sp.platform ?? ""}>
            <option value="">All platforms</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>
            ))}
          </select>
        </div>
      )}
      {statuses && (
        <div className="field">
          <label>Status</label>
          <select className="input" name="status" defaultValue={sp.status ?? ""}>
            <option value="">All statuses</option>
            {statuses.map((s) =>
              typeof s === "string" ? (
                <option key={s} value={s}>{s === "open" ? "Open (needs action)" : STATUS_LABEL[s] ?? s}</option>
              ) : (
                <option key={s.value} value={s.value}>{s.label}</option>
              ),
            )}
          </select>
        </div>
      )}
      {dates && (
        <>
          <div className="field" style={{ width: 150 }}>
            <label>From</label>
            <input className="input" type="date" name="from" defaultValue={sp.from ?? ""} />
          </div>
          <div className="field" style={{ width: 150 }}>
            <label>To</label>
            <input className="input" type="date" name="to" defaultValue={sp.to ?? ""} />
          </div>
        </>
      )}
      {extra}
      {hasAny && (
        <Link className="btn sm ghost" href={base} style={{ alignSelf: "flex-end" }}>
          Clear
        </Link>
      )}
    </FilterForm>
  );
}

export function exportHref(entity: string, sp: SP) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v) p.set(k, v);
  return `/api/export/${entity}?${p.toString()}`;
}

const ACTION_TEXT: Record<string, string> = {
  created: "created",
  status_changed: "changed status",
  reopened: "reopened",
  updated: "updated",
  archived: "archived",
  restored: "restored",
  reassigned: "reassigned",
  reviewed: "reviewed",
  pricing_updated: "updated pricing",
  default_pricing_updated: "updated default pricing",
  signed_in: "signed in",
  access_disabled: "turned access OFF",
  access_enabled: "turned access ON",
  password_reset: "reset password",
  password_changed: "changed own password",
  clients_reassigned: "reassigned clients",
  samples_removed: "removed sample data",
  settings_updated: "updated settings",
  enabled: "enabled",
  disabled: "disabled",
};

const ENTITY_TEXT: Record<string, string> = {
  client: "client",
  account: "ad account",
  topup: "top-up",
  payment: "payment",
  manager: "manager",
  pricing: "pricing",
  method: "bank / wallet",
  expense: "expense",
  settings: "settings",
  auth: "",
  system: "",
};

export function Timeline({ rows, showClient, base }: { rows: LogRow[]; showClient?: boolean; base?: string }) {
  if (!rows.length) return <div className="empty small">No activity yet.</div>;
  return (
    <ul className="timeline">
      {rows.map((r) => {
        const tone = r.after_status ? statusTone(r.after_status) : "gray";
        return (
          <li key={r.id}>
            <span className={`dot ${tone === "green" ? "" : tone}`} />
            <div>
              <div>
                <b>{r.user_name ?? "System"}</b> <span className="xs faint">({r.role})</span> {ACTION_TEXT[r.action] ?? r.action.replace(/_/g, " ")}{" "}
                {ENTITY_TEXT[r.entity_type] ?? r.entity_type}
                {r.entity_id && ["account", "topup", "payment"].includes(r.entity_type) ? ` #${r.entity_id}` : ""}
                {showClient && r.client_name && (
                  <>
                    {" · "}
                    {base ? <Link href={`${base}/clients/${r.client_id}`}>{r.client_name}</Link> : r.client_name}
                  </>
                )}
                {(r.before_status || r.after_status) && (
                  <span className="small">
                    {" "}
                    {r.before_status && (
                      <>
                        <span className="muted">{STATUS_LABEL[r.before_status] ?? r.before_status}</span> →{" "}
                      </>
                    )}
                    <b>{STATUS_LABEL[r.after_status ?? ""] ?? r.after_status}</b>
                  </span>
                )}
              </div>
              {r.details && <div className="small muted" style={{ wordBreak: "break-word" }}>{r.details}</div>}
              <div className="xs faint">{dateTime(r.ts)}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Everything the "new request / top-up / payment" forms need, scoped to the user. */
export function formContext(user: SessionUser) {
  const clients = clientOptions(user);
  const pricing: Record<number, Record<string, { price: number; fee: number }>> = {};
  for (const c of clients) pricing[c.id] = clientPricing(c.id);
  const s = clientScope(user);
  const allAccounts = db()
    .prepare(`SELECT a.id, a.client_id, a.name, a.status, a.account_price FROM accounts a JOIN clients c ON c.id = a.client_id WHERE ${s.sql} AND a.status != 'rejected' ORDER BY a.created_at DESC`)
    .all(...s.params) as { id: number; client_id: number; name: string; status: string; account_price: number }[];
  return {
    clients: clients.map((c) => ({ id: c.id, business_name: c.business_name })),
    pricing,
    activeAccounts: activeAccountOptions(user),
    allAccounts,
    methods: listMethods(true).map(({ id, name, logo, holder, account, currency, instructions }) => ({ id, name, logo, holder, account, currency, instructions })),
    fx: fxRates() as Record<string, number>,
    min: minTopup(),
  };
}
