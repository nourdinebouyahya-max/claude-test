import { privateJson, sameOrigin } from "@/lib/admin";
import { CURRENCIES, portalContext, proofExists, saveCrm, scopedClientIds, stamp } from "@/lib/portal";

type Body = { accountId?: string; amount?: number; currency?: string; amountUsd?: number; provider?: string; reference?: string; destinationCountry?: string; proofKey?: string; proofName?: string; proofType?: string };

export async function POST(request: Request) {
  if (!sameOrigin(request)) return privateJson({ error: "Invalid request origin." }, 403);
  try {
    const { user, record, grant } = await portalContext();
    if (!user || !record || !grant || !grant.permissions.includes("requestTopups")) return privateJson({ error: "Top-up requests are not available for this login." }, 403);
    const raw = await request.text();
    if (raw.length > 10_000) return privateJson({ error: "Request is too large." }, 413);
    let body: Body;
    try { body = JSON.parse(raw); } catch { return privateJson({ error: "Invalid request." }, 400); }
    if (!body || typeof body !== "object") return privateJson({ error: "Invalid request." }, 400);
    const state = record.state, ids = scopedClientIds(state, grant);
    const account = state.accounts.find(a => a.id === body.accountId);
    const amount = Number(body.amount), usd = body.currency === "USD" ? amount : Number(body.amountUsd);
    if (!account || !ids.has(account.clientId) || account.status !== "Active") return privateJson({ error: "Choose one of your active ad accounts." }, 400);
    if (!CURRENCIES.has(String(body.currency)) || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(usd) || usd < 100) return privateJson({ error: "Enter the amount, currency and at least $100 USD equivalent." }, 400);
    if (String(body.provider || "").length > 100 || String(body.reference || "").length > 200 || String(body.destinationCountry || "").length > 100) return privateJson({ error: "Check the payment method and reference." }, 400);
    if (body.proofKey && !(await proofExists(body.proofKey))) return privateJson({ error: "Upload the payment proof again." }, 400);
    const banks = ((state.receivingMethods || []) as Record<string, any>[]).filter(m => !m.demo && !(state.disabledMethods || []).includes(m.name)).map(m => m.name);
    if (banks.length && !banks.includes(String(body.provider))) return privateJson({ error: "Choose the bank or wallet you paid from." }, 400);
    const client = state.clients.find(c => c.id === account.clientId)!;
    const feePercent = Number(account.feePercent) || 0, feeUsd = Math.round(usd * feePercent) / 100, netUsd = Math.max(0, Math.round((usd - feeUsd) * 100) / 100);
    const now = new Date().toISOString(), topupId = `t${crypto.randomUUID()}`, paymentId = `p${crypto.randomUUID()}`;
    const by = { source: "portal", requestedBy: user.email, requestedRole: grant.role };
    const hasProof = !!body.proofKey;
    state.payments.unshift({ id: paymentId, topupId, accountId: account.id, purpose: "topup", clientId: client.id, amount, amountUsd: usd, currency: body.currency, method: body.provider || "", reference: String(body.reference || "").trim(), proof: hasProof ? String(body.proofName || "proof").slice(0, 120) : "", proofType: hasProof ? String(body.proofType || "") : "", proofKey: body.proofKey || "", status: "Pending", date: now.slice(0, 10), createdAt: now, ...by });
    state.topups.unshift({ id: topupId, clientId: client.id, accountId: account.id, accountName: account.name, adAccountId: account.accountId, platform: account.platform, amount, currency: body.currency, amountUsd: usd, feePercent, feeUsd, netUsd, paymentId, workflowSteps: { requestReceived: true, paymentVerified: false, supplierRequested: false, credited: false, confirmed: false }, provider: body.provider || "", destinationCountry: body.destinationCountry || "", manager: client.manager || account.manager || "Unassigned", status: hasProof ? "Payment review" : "Requested", createdAt: now, ...by });
    stamp(state.topups[0], { by: user.email, role: grant.role, action: "requested" }, now);
    (state.activity ||= []).unshift({ text: `Top-up requested from portal · ${client.business} · ${account.name}`, kind: "topup", recordId: topupId, clientId: client.id, createdAt: now });
    const saved = await saveCrm(record, now);
    return saved.ok ? privateJson({ created: 1 }, 201) : privateJson({ error: saved.error }, saved.status);
  } catch (error) {
    console.error("Portal top-up request failed", error);
    return privateJson({ error: "Could not send this request. Try again." }, 503);
  }
}
