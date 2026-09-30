"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Upload } from "lucide-react";
import { useApi, toast } from "./client";
import { BankLogo, PlatformIcon, BANK_LOGO_OPTIONS } from "./ui";
import {
  CURRENCIES, EXPENSE_CATEGORIES, MAX_PROOF_BYTES, ORIGIN_LABEL, PLATFORMS, PLATFORM_LABEL, PRICING_KEYS, TIME_ZONES,
  platformHasOrigin, pricingKey, pricingKeyLabel, type Currency, type Platform, type PricingKey,
} from "@/lib/constants";

type Pricing = Record<string, { price: number; fee: number }>;
const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Field({ label, req, hint, children, full }: { label: string; req?: boolean; hint?: ReactNode; children: ReactNode; full?: boolean }) {
  return (
    <div className={`field ${full ? "full" : ""}`}>
      <label>
        {label}
        {req && <span className="req">*</span>}
      </label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

function Foot({ busy, onCancel, label, disabled }: { busy: boolean; onCancel?: () => void; label: string; disabled?: boolean }) {
  return (
    <div className="row" style={{ justifyContent: "flex-end", marginTop: 18, gap: 10 }}>
      {onCancel && (
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      )}
      <button type="submit" className="btn primary" disabled={busy || disabled}>
        {busy ? "Saving…" : label}
      </button>
    </div>
  );
}

const Err = ({ e }: { e: string | null }) => (e ? <div className="error-box" style={{ marginTop: 14 }}>{e}</div> : null);

function formObj(e: FormEvent<HTMLFormElement>) {
  const fd = new FormData(e.currentTarget);
  const o: Record<string, string> = {};
  fd.forEach((v, k) => typeof v === "string" && (o[k] = v));
  return o;
}

/* ---------------- Client ---------------- */

export type ClientInit = {
  id?: number;
  business_name?: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  markets?: string | null;
  notes?: string | null;
};

export function ClientForm({ initial, managers, onDone, goTo }: { initial?: ClientInit; managers?: { id: number; name: string }[]; onDone?: () => void; goTo?: string }) {
  const { call, busy, error } = useApi();
  const router = useRouter();
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const body = formObj(e);
    const r = initial?.id
      ? await call(`/api/clients/${initial.id}`, "PATCH", { action: "update", ...body })
      : await call<{ id: number }>("/api/clients", "POST", body);
    if (r) {
      toast(initial?.id ? "Client updated" : "Client added");
      onDone?.();
      if (!initial?.id && goTo && "id" in r) router.push(`${goTo}/${r.id}`);
    }
  };
  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <Field label="Business name" req full>
          <input className="input" name="business_name" required maxLength={160} defaultValue={initial?.business_name} />
        </Field>
        <Field label="Contact name">
          <input className="input" name="contact_name" maxLength={120} defaultValue={initial?.contact_name ?? ""} />
        </Field>
        <Field label="Phone / WhatsApp" hint="Phone or email is required">
          <input className="input" name="phone" maxLength={40} defaultValue={initial?.phone ?? ""} placeholder="+212 6…" />
        </Field>
        <Field label="Email">
          <input className="input" name="email" type="email" maxLength={200} defaultValue={initial?.email ?? ""} />
        </Field>
        <Field label="Website">
          <input className="input" name="website" maxLength={300} defaultValue={initial?.website ?? ""} placeholder="https://" />
        </Field>
        <Field label="Target markets / countries" full>
          <input className="input" name="markets" maxLength={400} defaultValue={initial?.markets ?? ""} placeholder="e.g. Morocco, France, Saudi Arabia" />
        </Field>
        {managers && !initial?.id && (
          <Field label="Assigned manager" full>
            <select className="input" name="manager_id" defaultValue="">
              <option value="">— Unassigned —</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Notes" full>
          <textarea className="input" name="notes" maxLength={3000} defaultValue={initial?.notes ?? ""} />
        </Field>
      </div>
      {!initial?.id && <div className="info-box" style={{ marginTop: 14 }}>Agency default prices are applied automatically. Only the admin can change a client&apos;s prices.</div>}
      <Err e={error} />
      <Foot busy={busy} onCancel={onDone} label={initial?.id ? "Save changes" : "Add client"} />
    </form>
  );
}

/* ---------------- Account request ---------------- */

type ClientOpt = { id: number; business_name: string };

const PLATFORM_FIELDS: Record<Platform, { key: string; label: string; req?: boolean; type?: "textarea" | "email" | "origin"; hint?: string; placeholder?: string }[]> = {
  meta: [
    { key: "bm_id", label: "Business Manager ID", req: true, placeholder: "e.g. 123456789012345" },
    { key: "origin", label: "Origin", req: true, type: "origin" },
    { key: "pages", label: "Facebook Page links", req: true, type: "textarea", hint: "One per line, max 10", placeholder: "https://facebook.com/yourpage" },
    { key: "website", label: "Website", placeholder: "https://" },
  ],
  google: [
    { key: "google_email", label: "Google account email to invite", req: true, type: "email" },
    { key: "origin", label: "Origin", req: true, type: "origin" },
    { key: "website", label: "Website", req: true, placeholder: "https://" },
    { key: "mcc_id", label: "MCC ID (optional)", placeholder: "123-456-7890" },
  ],
  tiktok: [
    { key: "bc_id", label: "Business Center ID", req: true, placeholder: "e.g. 7234567890123456789" },
    { key: "share_email", label: "Email to share with", type: "email" },
    { key: "website", label: "Website or TikTok profile", req: true, placeholder: "https://… or @profile" },
  ],
  snapchat: [
    { key: "org_id", label: "Organization / Business ID", req: true },
    { key: "snap_email", label: "Snapchat email", type: "email" },
    { key: "website", label: "Website", placeholder: "https://" },
  ],
};

export function AccountRequestForm({
  clients,
  pricing,
  defaultClient,
  onDone,
}: {
  clients: ClientOpt[];
  pricing: Record<number, Pricing>;
  defaultClient?: number;
  onDone?: () => void;
}) {
  const { call, busy, error, setError } = useApi();
  const [clientId, setClientId] = useState<number | "">(defaultClient ?? (clients.length === 1 ? clients[0].id : ""));
  const [selected, setSelected] = useState<Platform[]>([]);
  const [count, setCount] = useState(1);
  const [tz, setTz] = useState("Africa/Casablanca");
  const [notes, setNotes] = useState("");
  const [vals, setVals] = useState<Record<string, Record<string, string>>>({ meta: { origin: "europe" }, google: { origin: "europe" }, tiktok: {}, snapchat: {} });

  const set = (p: Platform, k: string, v: string) => setVals((s) => ({ ...s, [p]: { ...s[p], [k]: v } }));
  const togglePlatform = (p: Platform) => setSelected((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));
  const pr = clientId ? pricing[clientId] : undefined;

  const missing = useMemo(() => {
    const out: string[] = [];
    if (!clientId) out.push("client");
    if (!selected.length) out.push("platform");
    for (const p of selected)
      for (const f of PLATFORM_FIELDS[p]) if (f.req && !(vals[p][f.key] ?? "").trim()) out.push(`${PLATFORM_LABEL[p]}: ${f.label}`);
    const pages = (vals.meta.pages ?? "").split("\n").filter((s) => s.trim());
    if (selected.includes("meta") && pages.length > 10) out.push("Meta: max 10 page links");
    return out;
  }, [clientId, selected, vals]);

  const lines = selected.map((p) => {
    const k = pricingKey(p, vals[p].origin);
    return { p, k, price: pr?.[k]?.price ?? 0, fee: pr?.[k]?.fee ?? 0 };
  });
  const total = lines.reduce((s, l) => s + l.price * count, 0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (missing.length) {
      setError(`Missing: ${missing.join(", ")}`);
      return;
    }
    const details: Record<string, unknown> = {};
    for (const p of selected) details[p] = { ...vals[p], ...(p === "meta" ? { pages: (vals.meta.pages ?? "").split("\n").map((s) => s.trim()).filter(Boolean) } : {}) };
    const r = await call("/api/accounts", "POST", { client_id: clientId, platforms: selected, count, timezone: tz, notes, details });
    if (r) {
      toast(`${selected.length * count} account request(s) sent`);
      onDone?.();
    }
  };

  return (
    <form onSubmit={submit} className="stack">
      <div className="form-grid">
        <Field label="Client" req>
          <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : "")} required>
            <option value="">Choose a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.business_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Accounts per platform" req hint="1 to 5">
          <select className="input" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="field">
        <span className="label-text">
          Platforms<span className="req">*</span>
        </span>
        <div className="platform-pick">
          {PLATFORMS.map((p) => (
            <label key={p} className={selected.includes(p) ? "on" : ""}>
              <input type="checkbox" checked={selected.includes(p)} onChange={() => togglePlatform(p)} />
              <PlatformIcon platform={p} size={22} />
              {PLATFORM_LABEL[p]}
            </label>
          ))}
        </div>
      </div>

      {selected.map((p) => {
        const l = lines.find((x) => x.p === p)!;
        return (
          <div key={p} className="platform-block">
            <div className="between">
              <h3 className="row">
                <PlatformIcon platform={p} /> {PLATFORM_LABEL[p]}
              </h3>
              <span className="small muted">
                {pr ? (
                  <>
                    <b className="tabular" style={{ color: "var(--primary-ink)" }}>${l.price}</b> / account · <b>{l.fee}%</b> top-up fee
                  </>
                ) : (
                  "Choose a client to see pricing"
                )}
              </span>
            </div>
            <div className="form-grid">
              {PLATFORM_FIELDS[p].map((f) => (
                <Field key={f.key} label={f.label} req={f.req} hint={f.hint} full={f.type === "textarea"}>
                  {f.type === "origin" ? (
                    <div className="seg">
                      {(["europe", "china"] as const).map((o) => (
                        <button type="button" key={o} className={vals[p].origin === o ? "on" : ""} onClick={() => set(p, "origin", o)}>
                          {ORIGIN_LABEL[o]}
                        </button>
                      ))}
                    </div>
                  ) : f.type === "textarea" ? (
                    <textarea className="input" rows={3} value={vals[p][f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => set(p, f.key, e.target.value)} />
                  ) : (
                    <input
                      className={`input ${f.key.endsWith("_id") ? "mono" : ""}`}
                      type={f.type === "email" ? "email" : "text"}
                      value={vals[p][f.key] ?? ""}
                      placeholder={f.placeholder}
                      onChange={(e) => set(p, f.key, e.target.value)}
                    />
                  )}
                </Field>
              ))}
            </div>
          </div>
        );
      })}

      <div className="form-grid">
        <Field label="Time zone" req>
          <select className="input" value={tz} onChange={(e) => setTz(e.target.value)}>
            {TIME_ZONES.map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
        </Field>
        <Field label="Notes">
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
        </Field>
      </div>

      {selected.length > 0 && pr && (
        <div className="summary">
          {lines.map((l) => (
            <div className="line" key={l.p}>
              <span>
                {pricingKeyLabel(l.k)} × {count} <span className="muted">· top-up fee {l.fee}%</span>
              </span>
              <span>{fmt(l.price * count)}</span>
            </div>
          ))}
          <div className="line total">
            <span>Total account price</span>
            <span>{fmt(total)}</span>
          </div>
        </div>
      )}
      {missing.length > 0 && selected.length > 0 && <div className="warn-box">Required: {missing.join(" · ")}</div>}
      <Err e={error} />
      <Foot busy={busy} onCancel={onDone} label="Send request" disabled={missing.length > 0} />
    </form>
  );
}

/* ---------------- Bank dropdown with logos ---------------- */

export type MethodOpt = { id: number; name: string; logo: string | null; holder: string | null; account: string | null; currency: string | null; instructions: string | null };

export function BankSelect({ methods, value, onChange }: { methods: MethodOpt[]; value: number | ""; onChange: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const cur = methods.find((m) => m.id === value);
  return (
    <div className="dropdown" ref={ref}>
      <button type="button" className="dropdown-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        {cur ? (
          <>
            <BankLogo logo={cur.logo} />
            <span className="grow bold">{cur.name}</span>
            <span className="muted small">{cur.currency}</span>
          </>
        ) : (
          <span className="grow muted">Choose bank / wallet…</span>
        )}
        <ChevronDown size={16} className="muted" />
      </button>
      {open && (
        <div className="dropdown-list" role="listbox">
          {methods.length === 0 && <div className="small muted" style={{ padding: 10 }}>No receiving method enabled. Ask the admin to add one in Banks.</div>}
          {methods.map((m) => (
            <button
              type="button"
              key={m.id}
              role="option"
              aria-selected={m.id === value}
              className={m.id === value ? "on" : ""}
              onClick={() => {
                onChange(m.id);
                setOpen(false);
              }}
            >
              <BankLogo logo={m.logo} />
              <span className="grow bold">{m.name}</span>
              <span className="muted small">{m.currency}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MethodDetails({ m }: { m: MethodOpt }) {
  const copy = (s: string) => navigator.clipboard?.writeText(s).then(() => toast("Copied"));
  return (
    <div className="summary">
      <dl className="kv" style={{ gridTemplateColumns: "110px 1fr" }}>
        <dt>Holder</dt>
        <dd className="bold">{m.holder}</dd>
        <dt>IBAN / wallet</dt>
        <dd>
          <span className="mono">{m.account}</span>{" "}
          {m.account && (
            <button type="button" className="btn xs" onClick={() => copy(m.account!)}>
              Copy
            </button>
          )}
        </dd>
        {m.currency && (
          <>
            <dt>Currency</dt>
            <dd>{m.currency}</dd>
          </>
        )}
        {m.instructions && (
          <>
            <dt>Instructions</dt>
            <dd>{m.instructions}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

function ProofInput({ file, setFile, setError }: { file: File | null; setFile: (f: File | null) => void; setError: (e: string | null) => void }) {
  return (
    <label className="dropdown-btn" style={{ cursor: "pointer", borderStyle: "dashed" }}>
      <Upload size={16} className="muted" />
      <span className="grow ellipsis">{file ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB` : "Upload proof — PNG, JPG, WEBP or PDF, max 1.5 MB"}</span>
      <input
        type="file"
        className="sr-only"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (f && f.size > MAX_PROOF_BYTES) {
            setError("Proof file is larger than 1.5 MB.");
            setFile(null);
            e.target.value = "";
            return;
          }
          if (f && !["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(f.type)) {
            setError("Proof must be PNG, JPG, WEBP or PDF.");
            setFile(null);
            e.target.value = "";
            return;
          }
          setError(null);
          setFile(f);
        }}
      />
    </label>
  );
}

function MoneyFields({
  amount, setAmount, currency, setCurrency, usdEq, setUsdEq, fx,
}: {
  amount: string; setAmount: (s: string) => void; currency: Currency; setCurrency: (c: Currency) => void; usdEq: string; setUsdEq: (s: string) => void; fx: Record<string, number>;
}) {
  const needsUsd = currency !== "USD" && currency !== "USDT";
  return (
    <div className="form-grid">
      <Field label="Amount paid" req>
        <input
          className="input tabular"
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            const n = Number(e.target.value.replace(",", "."));
            if (needsUsd && Number.isFinite(n)) setUsdEq(n ? (n * (fx[currency] ?? 1)).toFixed(2) : "");
          }}
          placeholder="0.00"
        />
      </Field>
      <Field label="Currency" req>
        <select
          className="input"
          value={currency}
          onChange={(e) => {
            const c = e.target.value as Currency;
            setCurrency(c);
            const n = Number(amount.replace(",", "."));
            setUsdEq(c !== "USD" && c !== "USDT" && n ? (n * (fx[c] ?? 1)).toFixed(2) : "");
          }}
        >
          {CURRENCIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      {needsUsd && (
        <Field label="USD equivalent" req hint={`Suggested at 1 ${currency} = $${fx[currency]} — adjust to the real rate`} full>
          <input className="input tabular" inputMode="decimal" value={usdEq} onChange={(e) => setUsdEq(e.target.value)} />
        </Field>
      )}
    </div>
  );
}

/* ---------------- Top-up ---------------- */

type AccOpt = { id: number; client_id: number; name: string; platform: string; origin: string | null; ad_account_id: string | null };

export function TopupForm({
  clients, accounts, methods, pricing, fx, min, defaultClient, defaultAccount, onDone,
}: {
  clients: ClientOpt[]; accounts: AccOpt[]; methods: MethodOpt[]; pricing: Record<number, Pricing>; fx: Record<string, number>; min: number;
  defaultClient?: number; defaultAccount?: number; onDone?: () => void;
}) {
  const { call, busy, error, setError } = useApi();
  const [clientId, setClientId] = useState<number | "">(defaultClient ?? "");
  const [accountId, setAccountId] = useState<number | "">(defaultAccount ?? "");
  const [methodId, setMethodId] = useState<number | "">("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [usdEq, setUsdEq] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const clientAccounts = accounts.filter((a) => a.client_id === clientId);
  const acc = accounts.find((a) => a.id === accountId);
  const method = methods.find((m) => m.id === methodId);
  const amt = Number(amount.replace(",", "."));
  const usd = currency === "USD" || currency === "USDT" ? amt : Number(usdEq.replace(",", "."));
  const feePct = acc && clientId ? pricing[clientId]?.[pricingKey(acc.platform as Platform, acc.origin)]?.fee ?? 0 : 0;
  const feeAmt = Number.isFinite(usd) ? Math.round(usd * feePct) / 100 : 0;
  const net = Number.isFinite(usd) ? usd - feeAmt : 0;
  const tooLow = Number.isFinite(usd) && usd > 0 && usd < min;
  const ready = !!clientId && !!accountId && !!methodId && amt > 0 && usd >= min && !!file;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) {
      setError(!file ? "Upload the payment proof." : tooLow ? `Minimum top-up is $${min}.` : "Fill all required fields.");
      return;
    }
    const fd = new FormData();
    fd.set("client_id", String(clientId));
    fd.set("account_id", String(accountId));
    fd.set("method_id", String(methodId));
    fd.set("amount", amount);
    fd.set("currency", currency);
    if (currency !== "USD" && currency !== "USDT") fd.set("usd_amount", usdEq);
    fd.set("reference", reference);
    fd.set("notes", notes);
    fd.set("proof", file!);
    const r = await call("/api/topups", "POST", fd);
    if (r) {
      toast("Top-up recorded");
      onDone?.();
    }
  };

  return (
    <form onSubmit={submit} className="stack">
      <div className="stack-sm">
        <span className="label-text">1 · Client & active ad account</span>
        <div className="form-grid">
          <select className="input" value={clientId} onChange={(e) => { setClientId(e.target.value ? Number(e.target.value) : ""); setAccountId(""); }}>
            <option value="">Choose a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.business_name}</option>
            ))}
          </select>
          <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : "")} disabled={!clientId}>
            <option value="">{clientId && !clientAccounts.length ? "No ACTIVE ad account" : "Choose an active ad account…"}</option>
            {clientAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}{a.ad_account_id ? ` — ${a.ad_account_id}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="stack-sm">
        <span className="label-text">2 · Bank / wallet the client paid to</span>
        <BankSelect methods={methods} value={methodId} onChange={setMethodId} />
        {method && <MethodDetails m={method} />}
      </div>
      <div className="stack-sm">
        <span className="label-text">3 · Amount</span>
        <MoneyFields amount={amount} setAmount={setAmount} currency={currency} setCurrency={setCurrency} usdEq={usdEq} setUsdEq={setUsdEq} fx={fx} />
        {tooLow && <div className="warn-box">Minimum top-up is ${min} (USD equivalent).</div>}
        <div className="form-grid">
          <Field label="Reference">
            <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} placeholder="Transfer / transaction ref" />
          </Field>
          <Field label="Notes">
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
          </Field>
        </div>
      </div>
      <div className="stack-sm">
        <span className="label-text">4 · Payment proof<span className="req">*</span></span>
        <ProofInput file={file} setFile={setFile} setError={setError} />
      </div>
      <div className="summary" aria-live="polite">
        <div className="line"><span className="muted">Amount</span><span>{amt > 0 ? `${amt.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}` : "—"}</span></div>
        {currency !== "USD" && <div className="line"><span className="muted">USD equivalent</span><span>{usd > 0 ? fmt(usd) : "—"}</span></div>}
        <div className="line"><span className="muted">Fee {acc ? `(${PLATFORM_LABEL[acc.platform as Platform]}${acc.origin ? ` ${ORIGIN_LABEL[acc.origin as "europe"]}` : ""} · ${feePct}%)` : ""}</span><span>{usd > 0 && acc ? `− ${fmt(feeAmt)}` : "—"}</span></div>
        <div className="line total"><span>Net credited</span><span>{usd > 0 && acc ? fmt(net) : "—"}</span></div>
      </div>
      <Err e={error} />
      <Foot busy={busy} onCancel={onDone} label="Record top-up" disabled={!ready} />
    </form>
  );
}

/* ---------------- Payment ---------------- */

export function PaymentForm({
  clients, accounts, methods, fx, defaultClient, onDone,
}: {
  clients: ClientOpt[]; accounts: { id: number; client_id: number; name: string; status: string; account_price: number }[]; methods: MethodOpt[];
  fx: Record<string, number>; defaultClient?: number; onDone?: () => void;
}) {
  const { call, busy, error, setError } = useApi();
  const [clientId, setClientId] = useState<number | "">(defaultClient ?? "");
  const [purpose, setPurpose] = useState<"account_order" | "general">("account_order");
  const [accountId, setAccountId] = useState<number | "">("");
  const [methodId, setMethodId] = useState<number | "">("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [usdEq, setUsdEq] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const clientAccounts = accounts.filter((a) => a.client_id === clientId);
  const method = methods.find((m) => m.id === methodId);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return setError("Upload the payment proof.");
    const fd = new FormData();
    Object.entries({ client_id: clientId, purpose, account_id: accountId, method_id: methodId, amount, currency, usd_amount: usdEq, reference, notes }).forEach(([k, v]) =>
      fd.set(k, String(v)),
    );
    fd.set("proof", file);
    const r = await call("/api/payments", "POST", fd);
    if (r) {
      toast("Payment recorded");
      onDone?.();
    }
  };

  return (
    <form onSubmit={submit} className="stack">
      <div className="form-grid">
        <Field label="Client" req>
          <select className="input" value={clientId} onChange={(e) => { setClientId(e.target.value ? Number(e.target.value) : ""); setAccountId(""); }}>
            <option value="">Choose a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.business_name}</option>
            ))}
          </select>
        </Field>
        <Field label="Pays for" req>
          <div className="seg">
            <button type="button" className={purpose === "account_order" ? "on" : ""} onClick={() => setPurpose("account_order")}>Account order</button>
            <button type="button" className={purpose === "general" ? "on" : ""} onClick={() => setPurpose("general")}>General</button>
          </div>
        </Field>
        {purpose === "account_order" && (
          <Field label="Account order" req full>
            <select
              className="input"
              value={accountId}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : "";
                setAccountId(id);
                const a = accounts.find((x) => x.id === id);
                if (a && !amount) { setAmount(String(a.account_price)); setCurrency("USD"); }
              }}
              disabled={!clientId}
            >
              <option value="">Choose the account…</option>
              {clientAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name} — ${a.account_price}</option>
              ))}
            </select>
          </Field>
        )}
      </div>
      <div className="stack-sm">
        <span className="label-text">Received on<span className="req">*</span></span>
        <BankSelect methods={methods} value={methodId} onChange={setMethodId} />
        {method && <MethodDetails m={method} />}
      </div>
      <MoneyFields amount={amount} setAmount={setAmount} currency={currency} setCurrency={setCurrency} usdEq={usdEq} setUsdEq={setUsdEq} fx={fx} />
      <div className="form-grid">
        <Field label="Reference">
          <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} />
        </Field>
        <Field label="Notes">
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
        </Field>
      </div>
      <div className="stack-sm">
        <span className="label-text">Proof<span className="req">*</span></span>
        <ProofInput file={file} setFile={setFile} setError={setError} />
      </div>
      <Err e={error} />
      <Foot busy={busy} onCancel={onDone} label="Record payment" disabled={!clientId || !methodId || !amount || !file || (purpose === "account_order" && !accountId)} />
    </form>
  );
}

/* ---------------- Admin forms ---------------- */

export function ManagerForm({ initial, onDone }: { initial?: { id: number; name: string; email: string; phone: string | null }; onDone?: () => void }) {
  const { call, busy, error } = useApi();
  const router = useRouter();
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const b = formObj(e);
    const r = initial
      ? await call(`/api/managers/${initial.id}`, "PATCH", { action: "update", ...b })
      : await call<{ id: number }>("/api/managers", "POST", b);
    if (r) {
      toast(initial ? "Manager updated" : "Manager created");
      onDone?.();
      if (!initial && "id" in r) router.push(`/admin/managers/${r.id}`);
    }
  };
  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <Field label="Full name" req full>
          <input className="input" name="name" required defaultValue={initial?.name} maxLength={120} />
        </Field>
        <Field label="Email (login)" req>
          <input className="input" name="email" type="email" required defaultValue={initial?.email} maxLength={200} autoComplete="off" />
        </Field>
        <Field label="Phone">
          <input className="input" name="phone" defaultValue={initial?.phone ?? ""} maxLength={40} />
        </Field>
        {!initial && (
          <Field label="Initial password" req hint="At least 8 characters. Share it privately — it is stored hashed and can't be viewed later." full>
            <input className="input" name="password" type="text" required minLength={8} autoComplete="new-password" />
          </Field>
        )}
      </div>
      <Err e={error} />
      <Foot busy={busy} onCancel={onDone} label={initial ? "Save" : "Create manager"} />
    </form>
  );
}

export function ResetPasswordForm({ id, onDone }: { id: number; onDone?: () => void }) {
  const { call, busy, error } = useApi();
  const [pw, setPw] = useState("");
  const gen = () => {
    const a = new Uint8Array(12);
    crypto.getRandomValues(a);
    setPw(Array.from(a, (b) => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"[b % 56]).join(""));
  };
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (await call(`/api/managers/${id}`, "PATCH", { action: "reset_password", password: pw })) {
          toast("Password reset — manager signed out everywhere");
          onDone?.();
        }
      }}
    >
      <Field label="New password" req hint="The manager is signed out of every device. Send the new password privately.">
        <div className="row">
          <input className="input mono" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} required autoComplete="new-password" />
          <button type="button" className="btn" onClick={gen}>Generate</button>
        </div>
      </Field>
      <Err e={error} />
      <Foot busy={busy} onCancel={onDone} label="Reset password" disabled={pw.length < 8} />
    </form>
  );
}

export function ReassignForm({ url, body, managers, current, onDone }: { url: string; body: (to: number) => unknown; managers: { id: number; name: string }[]; current?: number | null; onDone?: () => void }) {
  const { call, busy, error } = useApi();
  const [to, setTo] = useState<number | "">("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (to && (await call(url, "PATCH", body(to)))) {
          toast("Reassigned");
          onDone?.();
        }
      }}
    >
      <Field label="New manager" req>
        <select className="input" value={to} onChange={(e) => setTo(e.target.value ? Number(e.target.value) : "")}>
          <option value="">Choose…</option>
          {managers.filter((m) => m.id !== current).map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </Field>
      <Err e={error} />
      <Foot busy={busy} onCancel={onDone} label="Reassign" disabled={!to} />
    </form>
  );
}

export function PricingEditor({ url, values, defaults, confirmReview }: { url: string; values: Pricing; defaults?: Pricing; confirmReview?: boolean }) {
  const { call, busy, error } = useApi();
  const [v, setV] = useState<Record<string, { price: string; fee: string }>>(
    Object.fromEntries(PRICING_KEYS.map((k) => [k, { price: String(values[k]?.price ?? ""), fee: String(values[k]?.fee ?? "") }])),
  );
  const save = async (review: boolean) => {
    const body: Record<string, unknown> = {};
    for (const k of PRICING_KEYS) {
      body[`${k}.price`] = v[k].price;
      body[`${k}.fee`] = v[k].fee;
    }
    if (review) body.confirm_review = true;
    if (await call(url, "PUT", body)) toast(review ? "Pricing confirmed & client reviewed" : "Pricing saved");
  };
  return (
    <div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Platform</th>
              <th className="num">Account price ($)</th>
              <th className="num">Top-up fee (%)</th>
              {defaults && <th className="num">Default</th>}
            </tr>
          </thead>
          <tbody>
            {PRICING_KEYS.map((k: PricingKey) => {
              const [p, o] = k.split(":");
              const custom = defaults && (Number(v[k].price) !== defaults[k]?.price || Number(v[k].fee) !== defaults[k]?.fee);
              return (
                <tr key={k}>
                  <td>
                    <span className="plat">
                      <PlatformIcon platform={p} /> {PLATFORM_LABEL[p as Platform]}
                      {o && <span className="muted" style={{ fontWeight: 500 }}>· {ORIGIN_LABEL[o as "europe"]}</span>}
                      {custom && <span className="tag">custom</span>}
                    </span>
                  </td>
                  <td className="num">
                    <input className="input sm tabular" style={{ width: 100, textAlign: "right" }} inputMode="decimal" value={v[k].price} onChange={(e) => setV((s) => ({ ...s, [k]: { ...s[k], price: e.target.value } }))} />
                  </td>
                  <td className="num">
                    <input className="input sm tabular" style={{ width: 90, textAlign: "right" }} inputMode="decimal" value={v[k].fee} onChange={(e) => setV((s) => ({ ...s, [k]: { ...s[k], fee: e.target.value } }))} />
                  </td>
                  {defaults && <td className="num muted">${defaults[k]?.price} · {defaults[k]?.fee}%</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Err e={error} />
      <div className="row" style={{ justifyContent: "flex-end", gap: 10, padding: "14px 16px 0" }}>
        <button className="btn primary" disabled={busy} onClick={() => save(false)}>Save pricing</button>
        {confirmReview && <button className="btn primary" disabled={busy} onClick={() => save(true)}>Save & mark reviewed</button>}
      </div>
    </div>
  );
}

export function MethodForm({ initial, onDone }: { initial?: MethodOpt & { enabled: number }; onDone?: () => void }) {
  const { call, busy, error } = useApi();
  const [logo, setLogo] = useState(initial?.logo ?? "bank");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const b = { ...formObj(e), logo, enabled: (e.currentTarget.elements.namedItem("enabled") as HTMLInputElement).checked };
        const r = initial ? await call(`/api/methods/${initial.id}`, "PATCH", { action: "update", ...b }) : await call("/api/methods", "POST", b);
        if (r) {
          toast("Saved");
          onDone?.();
        }
      }}
    >
      <div className="form-grid">
        <Field label="Name" req>
          <input className="input" name="name" required defaultValue={initial?.name} placeholder="e.g. CIH Bank, USDT TRC20" maxLength={80} />
        </Field>
        <Field label="Logo">
          <div className="row">
            <BankLogo logo={logo} />
            <select className="input" value={logo} onChange={(e) => setLogo(e.target.value)}>
              {BANK_LOGO_OPTIONS.map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </div>
        </Field>
        <Field label="Account holder" req>
          <input className="input" name="holder" required defaultValue={initial?.holder ?? ""} maxLength={120} />
        </Field>
        <Field label="Currency">
          <select className="input" name="currency" defaultValue={initial?.currency ?? "MAD"}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="IBAN / account / wallet" req full>
          <input className="input mono" name="account" required defaultValue={initial?.account ?? ""} maxLength={200} />
        </Field>
        <Field label="Instructions" full>
          <textarea className="input" name="instructions" defaultValue={initial?.instructions ?? ""} maxLength={1000} placeholder="Shown to managers when this method is chosen" />
        </Field>
        <label className="check full">
          <input type="checkbox" name="enabled" defaultChecked={initial ? !!initial.enabled : true} /> Enabled (shown in the top-up form)
        </label>
      </div>
      <Err e={error} />
      <Foot busy={busy} onCancel={onDone} label="Save" />
    </form>
  );
}

export function ExpenseForm({ managers, today, onDone }: { managers: { id: number; name: string }[]; today: string; onDone?: () => void }) {
  const { call, busy, error } = useApi();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (await call("/api/expenses", "POST", formObj(e))) {
          toast("Expense added");
          onDone?.();
        }
      }}
    >
      <div className="form-grid">
        <Field label="Date" req>
          <input className="input" type="date" name="date" required defaultValue={today} />
        </Field>
        <Field label="Amount (USD)" req>
          <input className="input tabular" name="amount_usd" inputMode="decimal" required />
        </Field>
        <Field label="Category" req>
          <select className="input" name="category">
            {Object.entries(EXPENSE_CATEGORIES).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Linked manager" hint="Used for profit per manager">
          <select className="input" name="manager_id" defaultValue="">
            <option value="">— Agency —</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Description" full>
          <input className="input" name="description" maxLength={300} />
        </Field>
      </div>
      <Err e={error} />
      <Foot busy={busy} onCancel={onDone} label="Add expense" />
    </form>
  );
}

export function SettingsForm({ fx, min, agency }: { fx: Record<string, number>; min: number; agency: string }) {
  const { call, busy, error } = useApi();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const o = formObj(e);
        if (await call("/api/settings", "PUT", o)) toast("Settings saved");
      }}
    >
      <div className="form-grid">
        <Field label="Agency name">
          <input className="input" name="agency_name" defaultValue={agency} maxLength={80} />
        </Field>
        <Field label="Minimum top-up (USD)" req>
          <input className="input tabular" name="min_topup_usd" defaultValue={min} inputMode="decimal" />
        </Field>
        {CURRENCIES.filter((c) => c !== "USD").map((c) => (
          <Field key={c} label={`1 ${c} = ? USD`} req hint="Used to suggest the USD equivalent">
            <input className="input tabular" name={`fx.${c}`} defaultValue={fx[c]} inputMode="decimal" />
          </Field>
        ))}
      </div>
      <Err e={error} />
      <Foot busy={busy} label="Save settings" />
    </form>
  );
}

export function PasswordForm() {
  const { call, busy, error } = useApi();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        if (await call("/api/settings/password", "PUT", formObj(e), { refresh: false })) {
          toast("Password changed");
          form.reset();
        }
      }}
    >
      <div className="form-grid">
        <Field label="Current password" req>
          <input className="input" type="password" name="current" required autoComplete="current-password" />
        </Field>
        <Field label="New password" req hint="At least 8 characters">
          <input className="input" type="password" name="next" required minLength={8} autoComplete="new-password" />
        </Field>
      </div>
      <Err e={error} />
      <Foot busy={busy} label="Change password" />
    </form>
  );
}
