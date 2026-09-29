"use client";

import { useState } from "react";

type Row = Record<string, any>;
const platforms = [{ id: "Meta", name: "Meta Ads", logo: "meta.svg" }, { id: "TikTok", name: "TikTok Ads", logo: "tiktok.svg" }, { id: "Google", name: "Google Ads", logo: "googleads.svg" }, { id: "Snapchat", name: "Snapchat Ads", logo: "snapchat.svg" }];
const money = (v: unknown) => `$${Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const when = (v: unknown) => v ? new Date(String(v)).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Casablanca" }) : "—";
const badge = (s: string) => <span className={`portal-status ${(s || "").toLowerCase().replace(/\W+/g, "-")}`}>{s || "—"}</span>;

/** "2h 10m" between two ISO times. */
export function elapsed(from?: string, to?: string) {
  if (!from || !to) return "";
  const minutes = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
}

/** How the agency answered a request: answered in…, finished in…, or the rejection reason. */
export function Response({ x }: { x: Row }) {
  return <>
    {x.managerStatus === "Rejected" || x.status === "Rejected" ? <small className="portal-reject">Rejected{x.rejectReason ? `: ${x.rejectReason}` : ""}</small> : null}
    {x.respondedAt ? <small>Answered in {elapsed(x.createdAt, x.respondedAt)}{x.decidedAt ? ` · closed in ${elapsed(x.createdAt, x.decidedAt)}` : ""}</small> : <small>Waiting for your manager</small>}
  </>;
}

export function AccountRequestForm({ role, clients, fields, disabled, onDone }: { role: "client" | "manager"; clients: Row[]; fields: Record<string, Row[]>; disabled: boolean; onDone: (message: string) => void }) {
  const [clientId, setClientId] = useState(clients[0]?.id || ""), [timezone, setTimezone] = useState("Africa/Casablanca"), [notes, setNotes] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [items, setItems] = useState<Row[]>(() => platforms.map(p => ({ platform: p.id, selected: false, count: 1, region: "Europe", fields: {} })));
  const client = clients.find(c => c.id === clientId);
  const change = (i: number, patch: Row) => setItems(old => old.map((x, n) => n === i ? { ...x, ...patch } : x));
  const rateOf = (x: Row) => client?.rates?.[["Meta", "Google"].includes(x.platform) ? `${x.platform}_${x.region}` : x.platform];

  async function send() {
    if (disabled) { setMessage("Preview only. Sign in as this user to submit."); return; }
    const chosen = items.filter(x => x.selected);
    if (!chosen.length) { setMessage("Choose at least one platform."); return; }
    for (const x of chosen) for (const f of fields[x.platform] || []) if (f.required && !String(x.fields[f.key] || "").trim()) { setMessage(`${x.platform}: ${f.label} is required.`); return; }
    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/portal/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId, timezone, notes, items: chosen.map(x => ({ platform: x.platform, count: Number(x.count), region: ["Meta", "Google"].includes(x.platform) ? x.region : "", fields: x.fields })) }) });
      const json = await res.json() as Row;
      if (!res.ok) throw new Error(json.error || "Could not send.");
      setItems(platforms.map(p => ({ platform: p.id, selected: false, count: 1, region: "Europe", fields: {} }))); setNotes("");
      onDone(`${json.created} account request${json.created === 1 ? "" : "s"} sent. Your manager and the agency admin can see ${json.created === 1 ? "it" : "them"} now.`);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not send."); } finally { setBusy(false); }
  }

  return <section className="portal-panel portal-request">
    <h2>Request ad accounts</h2>
    <p>Choose the platforms and give the information the agency needs to open each account. The request goes to your manager and the admin.</p>
    {role === "manager" && <label>Client<select value={clientId} onChange={e => setClientId(e.target.value)}>{clients.map(c => <option key={c.id} value={c.id}>{c.business}</option>)}</select></label>}
    <div className="portal-request-grid">{items.map((x, i) => {
      const rate = x.selected ? rateOf(x) : null;
      return <div className={`portal-platform ${x.selected ? "selected" : ""}`} key={x.platform}>
        <label className="portal-platform-head"><input type="checkbox" checked={x.selected} onChange={e => change(i, { selected: e.target.checked })} />
          <span className="portal-brand"><img src={`/icons/${platforms[i].logo}`} alt="" />{platforms[i].name}</span></label>
        {x.selected && <div className="portal-platform-fields">
          <label>Number of accounts<input type="number" min={1} max={5} value={x.count} onChange={e => change(i, { count: Number(e.target.value) })} /></label>
          {["Meta", "Google"].includes(x.platform) && <label>Origin<select value={x.region} onChange={e => change(i, { region: e.target.value })}><option>Europe</option><option>China</option></select></label>}
          {(fields[x.platform] || []).map(f => f.list
            ? <label key={f.key}>{f.label}{f.required ? " *" : ""}<textarea value={x.fields[f.key] || ""} placeholder={f.placeholder} onChange={e => change(i, { fields: { ...x.fields, [f.key]: e.target.value } })} /></label>
            : <label key={f.key}>{f.label}{f.required ? " *" : ""}<input value={x.fields[f.key] || ""} placeholder={f.placeholder} onChange={e => change(i, { fields: { ...x.fields, [f.key]: e.target.value } })} /></label>)}
          {rate && <small>Your rate: {money(rate.price)} per account · top-up fee {rate.fee}%</small>}
        </div>}
      </div>;
    })}</div>
    <div className="portal-request-foot"><label>Account time zone<select value={timezone} onChange={e => setTimezone(e.target.value)}>{["UTC", ...Intl.supportedValuesOf("timeZone")].map(t => <option key={t}>{t}</option>)}</select></label><label>Notes for your agency<textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} placeholder="Optional details" /></label></div>
    <button className="portal-primary" type="button" disabled={busy || disabled} onClick={send}>{disabled ? "Preview only" : busy ? "Sending…" : "Send request"}</button>
    {message && <p role="status" className="portal-notice">{message}</p>}
  </section>;
}

const ACTIONS: Record<string, { action: string; label: string; primary?: boolean; reason?: boolean }[]> = {
  account: [{ action: "start", label: "Start" }, { action: "done", label: "Mark done", primary: true }, { action: "reject", label: "Reject", reason: true }],
  topup: [{ action: "verify", label: "Payment received" }, { action: "processing", label: "Processing" }, { action: "complete", label: "Complete", primary: true }, { action: "reject", label: "Reject", reason: true }],
  payment: [{ action: "verify", label: "Verify payment", primary: true }, { action: "reject", label: "Reject", reason: true }],
};

/** The manager's work queue: check the proof, record the payment, process the top-up, complete it or reject it with a reason. */
export function TaskList({ tasks, disabled, onAction }: { tasks: Row[]; disabled: boolean; onAction: (t: Row, action: string, note: string) => Promise<string | null> }) {
  const [rejecting, setRejecting] = useState<string | null>(null), [reason, setReason] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("open");
  const shown = tasks.filter(t => filter === "all" || (filter === "open" ? !["Done", "Rejected"].includes(t.state) : t.state === "Done" || t.state === "Rejected"));
  async function run(t: Row, action: string, note = "") {
    setBusy(true); setError("");
    const problem = await onAction(t, action, note);
    setBusy(false);
    if (problem) setError(problem); else { setRejecting(null); setReason(""); }
  }
  return <section className="portal-panel">
    <h2>Requests from your clients</h2>
    <p>Open the proof, confirm the payment and process each request. Every action and its timing is visible to the agency admin. A rejection needs a reason.</p>
    <div className="portal-tabs-inline">{[["open", "Open"], ["closed", "Closed"], ["all", "All"]].map(([k, l]) => <button key={k} type="button" className={filter === k ? "active" : ""} onClick={() => setFilter(k)}>{l}</button>)}</div>
    {error && <p role="status" className="portal-notice">{error}</p>}
    {shown.map(t => {
      const key = t.kind + t.id, closed = ["Done", "Rejected"].includes(t.state);
      return <article className="portal-task" key={key}>
        <div className="portal-task-head"><div><small>{t.kind === "account" ? "Account request" : t.kind === "topup" ? "Top-up" : "Payment proof"} · {t.clientName}</small><h3>{t.title}</h3><small>{t.detail}</small></div><div>{badge(t.state)}<small>Agency: {t.agencyStatus}</small></div></div>
        <div className="portal-task-body">
          <small>Received {when(t.createdAt)}{t.by ? ` · from ${t.by}` : ""}</small>
          {t.respondedAt ? <small>You answered in {elapsed(t.createdAt, t.respondedAt)}{t.decidedAt ? ` · closed in ${elapsed(t.createdAt, t.decidedAt)}` : ""}</small> : <small className="portal-reject">Not answered yet · waiting {elapsed(t.createdAt, new Date().toISOString())}</small>}
          {t.kind !== "account" && <small>Amount {t.amount} {t.currency}{t.method ? ` · via ${t.method}` : ""}{t.reference ? ` · ref ${t.reference}` : ""} · payment {t.paymentStatus || "—"}</small>}
          {t.kind !== "account" && (t.proofUrl ? <a href={t.proofUrl} target="_blank" rel="noreferrer">View payment proof ↗</a> : <small className="portal-reject">No proof attached yet</small>)}
          {t.kind === "account" && t.fields && <dl>{Object.entries(t.fields).filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{String(v)}</dd></div>)}</dl>}
          {t.notes && <small>Client note: {t.notes}</small>}
          {t.state === "Rejected" && <small className="portal-reject">Rejected: {t.rejectReason}</small>}
        </div>
        {!disabled && <div className="portal-task-actions">
          {closed ? <button type="button" disabled={busy} onClick={() => run(t, "reopen")}>Reopen</button>
            : rejecting === key ? <div className="portal-reject-form"><input value={reason} maxLength={300} onChange={e => setReason(e.target.value)} placeholder="Reason for rejecting (the client will see it)" /><button type="button" className="portal-primary" disabled={busy} onClick={() => run(t, "reject", reason)}>Confirm rejection</button><button type="button" onClick={() => { setRejecting(null); setReason(""); }}>Cancel</button></div>
            : ACTIONS[t.kind].map(a => <button type="button" key={a.action} className={a.primary ? "portal-primary" : ""} disabled={busy} onClick={() => a.reason ? setRejecting(key) : run(t, a.action)}>{a.label}</button>)}
        </div>}
      </article>;
    })}
    {!shown.length && <div className="portal-empty">Nothing here. New client requests appear in Open.</div>}
  </section>;
}

export function AddClientDialog({ onClose, onDone }: { onClose: () => void; onDone: (message: string) => void }) {
  const [v, setV] = useState<Row>({ name: "", business: "", phone: "", email: "", website: "", markets: "", notes: "" }), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function save() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/portal/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
      const json = await res.json() as Row;
      if (!res.ok) throw new Error(json.error || "Could not add the client.");
      onDone(`${v.business} was added. The agency admin can see it now and will finish the setup.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not add the client."); } finally { setBusy(false); }
  }
  const input = (key: string, label: string, extra: Row = {}) => <label key={key}>{label}<input value={v[key]} onChange={e => setV((o: Row) => ({ ...o, [key]: e.target.value }))} {...extra} /></label>;
  return <div className="portal-edit-backdrop" role="presentation"><section className="portal-edit-dialog" role="dialog" aria-modal="true" aria-label="Add client">
    <h2>Add a client</h2>
    {input("business", "Business / brand name *")}{input("name", "Client name *")}{input("phone", "Phone *")}{input("email", "Email", { type: "email" })}{input("website", "Website", { placeholder: "https://" })}{input("markets", "Target markets")}
    <label>Notes for the admin (agreed fees, what the client wants)<textarea value={v.notes} maxLength={1000} onChange={e => setV((o: Row) => ({ ...o, notes: e.target.value }))} /></label>
    {error && <p role="status" className="portal-notice">{error}</p>}
    <div><button className="portal-edit" type="button" onClick={onClose}>Cancel</button><button className="portal-primary" type="button" disabled={busy} onClick={save}>{busy ? "Saving…" : "Add client"}</button></div>
  </section></div>;
}
