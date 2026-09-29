"use client";

import { useState } from "react";

type Row = Record<string, any>;
const CURRENCIES = ["USD", "MAD", "EUR", "GBP", "USDT"];
const today = () => new Date().toISOString().slice(0, 10);

// One form for both portal submissions: a top-up request on an active ad account, or a payment proof for an account order / general payment.
export function SubmitForm({ mode, role, clients, accounts, methods, disabled, onDone }: {
  mode: "topup" | "payment"; role: "client" | "manager"; clients: Row[]; accounts: Row[]; methods: Row[]; disabled: boolean; onDone: (message: string) => void;
}) {
  const [clientId, setClientId] = useState(clients[0]?.id || ""), [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState(""), [currency, setCurrency] = useState("USD"), [amountUsd, setAmountUsd] = useState("");
  const [method, setMethod] = useState(""), [reference, setReference] = useState(""), [country, setCountry] = useState("");
  const [file, setFile] = useState<File | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const topup = mode === "topup";
  const scoped = accounts.filter(a => role === "client" || !clientId || a.clientId === clientId);
  const chosen = methods.find(m => m.name === method);
  const usd = currency === "USD" ? Number(amount) : Number(amountUsd);
  const account = accounts.find(a => a.id === accountId);
  const fee = topup && account ? Math.round(usd * (Number(account.feePercent) || 0)) / 100 : 0;

  async function submit() {
    if (disabled) { setMessage("Preview only. Sign in as this user to submit."); return; }
    if (topup && !accountId) { setMessage("Choose an ad account."); return; }
    if (topup && methods.length && !method) { setMessage("Choose the bank or wallet you paid from."); return; }
    if (!(Number(amount) > 0) || !(usd > 0)) { setMessage("Enter the amount and its USD equivalent."); return; }
    if (topup && usd < 100) { setMessage("The minimum top-up is $100 USD equivalent."); return; }
    if (!topup && !file) { setMessage("Attach the payment proof."); return; }
    setBusy(true); setMessage("");
    try {
      let proof: Row = {};
      if (file) {
        const body = new FormData(); body.append("proof", file);
        const up = await fetch("/api/portal/proofs", { method: "POST", body }), uploaded = await up.json() as Row;
        if (!up.ok) throw new Error(uploaded.error || "Proof upload failed.");
        proof = { proofKey: uploaded.key, proofName: uploaded.name, proofType: uploaded.type };
      }
      const common = { amount: Number(amount), currency, amountUsd: usd, reference, ...proof };
      const res = await fetch(topup ? "/api/portal/topups" : "/api/portal/payments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(topup ? { ...common, accountId, provider: method, destinationCountry: country } : { ...common, clientId, accountId, method }),
      });
      const json = await res.json() as Row;
      if (!res.ok) throw new Error(json.error || "Could not send.");
      setAmount(""); setAmountUsd(""); setReference(""); setFile(null); setAccountId("");
      onDone(topup ? "Top-up request sent. The agency will review your proof and credit the account." : "Payment proof sent. The agency will verify it shortly.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not send."); } finally { setBusy(false); }
  }

  return <section className="portal-panel portal-request">
    <h2>{topup ? "Request a top-up" : "Submit a payment proof"}</h2>
    <p>{topup ? "Pay the agency using one of the methods below, attach the proof and choose the ad account to fund." : "Send the proof for an ad account order or a general payment. The agency verifies it and updates the status."}</p>
    <div className="portal-request-foot"><label>{topup ? "Which bank or wallet will you pay from? *" : "Payment method"}<select value={method} onChange={e => setMethod(e.target.value)}><option value="">Choose a bank or wallet</option>{methods.map(m => <option key={m.id} value={m.name}>{m.name} · {m.currency}</option>)}</select></label></div>
    {chosen && <article className="portal-panel portal-bank"><small>Send the money to · {chosen.currency}{chosen.country ? ` · ${chosen.country}` : ""}</small><h2>{chosen.name}</h2><dl><dt>Account holder</dt><dd>{chosen.holder}</dd><dt>Account / IBAN / wallet</dt><dd>{chosen.details}</dd>{chosen.instructions && <><dt>Instructions</dt><dd>{chosen.instructions}</dd></>}</dl></article>}
    <div className="portal-request-foot">
      {role === "manager" && <label>Client<select value={clientId} onChange={e => { setClientId(e.target.value); setAccountId(""); }}>{clients.map(c => <option key={c.id} value={c.id}>{c.business}</option>)}</select></label>}
      <label>{topup ? "Ad account" : "Payment for"}<select value={accountId} onChange={e => setAccountId(e.target.value)}>{!topup && <option value="">General payment</option>}{topup && <option value="">Choose an account</option>}{scoped.map(a => <option key={a.id} value={a.id}>{a.name}{a.accountId ? ` · ${a.accountId}` : ""}</option>)}</select></label>
      <label>Amount paid<input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></label>
      <label>Currency<select value={currency} onChange={e => setCurrency(e.target.value)}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></label>
      {currency !== "USD" && <label>USD equivalent<input type="number" min="0.01" step="0.01" value={amountUsd} onChange={e => setAmountUsd(e.target.value)} /></label>}
      <label>Reference / transaction ID<input value={reference} maxLength={200} onChange={e => setReference(e.target.value)} /></label>
      {topup && <label>Destination country<input value={country} maxLength={100} onChange={e => setCountry(e.target.value)} placeholder="Optional" /></label>}
      <label>Payment proof{topup ? " (recommended)" : ""}<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
    </div>
    {topup && account && usd > 0 && <article className="portal-panel portal-bank"><h2>Top-up summary</h2><dl><dt>You send</dt><dd>{amount} {currency}{currency !== "USD" ? ` (≈ $${usd.toLocaleString("en-US")})` : ""}</dd><dt>Agency fee ({account.feePercent}% for {account.platform})</dt><dd>− ${fee.toLocaleString("en-US")}</dd><dt>Credited to the ad account</dt><dd><strong>${Math.max(0, usd - fee).toLocaleString("en-US")}</strong></dd></dl></article>}
    <button className="portal-primary" type="button" disabled={busy || disabled} onClick={submit}>{disabled ? "Preview only" : busy ? "Sending…" : topup ? "Send top-up request" : "Send payment proof"}</button>
    {message && <p role="status" className="portal-notice">{message}</p>}
  </section>;
}
