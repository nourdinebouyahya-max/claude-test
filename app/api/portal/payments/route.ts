import { privateJson, sameOrigin } from "@/lib/admin";
import { CURRENCIES, portalContext, proofExists, saveCrm, scopedClientIds, stamp } from "@/lib/portal";

type Body = { clientId?: string; accountId?: string; amount?: number; currency?: string; amountUsd?: number; method?: string; reference?: string; proofKey?: string; proofName?: string; proofType?: string };

export async function POST(request: Request) {
  if (!sameOrigin(request)) return privateJson({ error: "Invalid request origin." }, 403);
  try {
    const { user, record, grant } = await portalContext();
    if (!user || !record || !grant || !grant.permissions.includes("submitPayments")) return privateJson({ error: "Payment submission is not available for this login." }, 403);
    const raw = await request.text();
    if (raw.length > 10_000) return privateJson({ error: "Request is too large." }, 413);
    let body: Body;
    try { body = JSON.parse(raw); } catch { return privateJson({ error: "Invalid request." }, 400); }
    if (!body || typeof body !== "object") return privateJson({ error: "Invalid request." }, 400);
    const state = record.state, ids = scopedClientIds(state, grant);
    const clientId = grant.role === "client" ? grant.clientId : body.clientId;
    const client = state.clients.find(c => c.id === clientId);
    const account = body.accountId ? state.accounts.find(a => a.id === body.accountId) : null;
    const amount = Number(body.amount), usd = body.currency === "USD" ? amount : Number(body.amountUsd);
    if (!client || !ids.has(client.id) || (body.accountId && (!account || account.clientId !== client.id))) return privateJson({ error: "Choose one of your clients and accounts." }, 400);
    if (!CURRENCIES.has(String(body.currency)) || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(usd) || usd <= 0) return privateJson({ error: "Enter the amount, currency and its USD equivalent." }, 400);
    if (String(body.method || "").length > 100 || String(body.reference || "").length > 200) return privateJson({ error: "Check the payment method and reference." }, 400);
    if (!body.proofKey || !(await proofExists(body.proofKey))) return privateJson({ error: "Upload the payment proof first." }, 400);
    const now = new Date().toISOString(), paymentId = `p${crypto.randomUUID()}`;
    state.payments.unshift({ id: paymentId, clientId: client.id, purpose: account ? "account" : "general", accountId: account?.id || "", amount, amountUsd: usd, currency: body.currency, method: body.method || "", reference: String(body.reference || "").trim(), proof: String(body.proofName || "proof").slice(0, 120), proofType: String(body.proofType || ""), proofKey: body.proofKey, status: "Pending", date: now.slice(0, 10), createdAt: now, source: "portal", requestedBy: user.email, requestedRole: grant.role });
    stamp(state.payments[0], { by: user.email, role: grant.role, action: "requested" }, now);
    (state.activity ||= []).unshift({ text: `Payment proof submitted from portal · ${client.business}${account ? ` · ${account.name}` : ""}`, kind: "payment", recordId: paymentId, clientId: client.id, createdAt: now });
    const saved = await saveCrm(record, now);
    return saved.ok ? privateJson({ created: 1 }, 201) : privateJson({ error: saved.error }, saved.status);
  } catch (error) {
    console.error("Portal payment submission failed", error);
    return privateJson({ error: "Could not send this payment. Try again." }, 503);
  }
}
