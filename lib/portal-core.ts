export const MANAGER_SECTIONS = ["overview", "clients", "accounts", "topups", "payments", "academy", "activity", "requestAccounts", "requestTopups", "submitPayments", "tasks", "addClients"] as const;
export const CLIENT_SECTIONS = ["overview", "accounts", "topups", "payments", "academy", "activity", "requestAccounts", "requestTopups", "submitPayments"] as const;
export type Section = (typeof MANAGER_SECTIONS)[number];
export const TASK_KINDS = { account: "accounts", topup: "topups", payment: "payments" } as const;
export type TaskKind = keyof typeof TASK_KINDS;
export const TASK_ACTIONS: Record<TaskKind, readonly string[]> = {
  account: ["start", "done", "reject", "reopen"],
  topup: ["verify", "processing", "complete", "reject", "reopen"],
  payment: ["verify", "reject", "reopen"],
};
export type Grant = { email: string; role: "manager" | "client"; clientId?: string; managerName?: string; clientIds?: string[]; permissions: Section[]; active: boolean };
export type RecordValue = Record<string, any>;
export type CrmState = RecordValue & { clients: RecordValue[]; accounts: RecordValue[]; payments: RecordValue[]; topups: RecordValue[]; academy?: RecordValue[]; activity?: RecordValue[]; managers?: RecordValue[]; accessGrants?: Grant[] };

// What the agency needs from a client before it can order each kind of ad account.
export type PlatformField = { key: string; label: string; required?: boolean; list?: boolean; placeholder?: string };
export const PLATFORM_FIELDS: Record<string, PlatformField[]> = {
  Meta: [
    { key: "bmId", label: "Business Manager (BM) ID", required: true, placeholder: "e.g. 123456789012345" },
    { key: "pages", label: "Facebook Page links (one per line)", required: true, list: true, placeholder: "https://facebook.com/yourpage" },
    { key: "website", label: "Website / landing page" },
  ],
  Google: [
    { key: "googleEmail", label: "Google account email to invite", required: true, placeholder: "name@gmail.com" },
    { key: "website", label: "Website URL", required: true, placeholder: "https://" },
    { key: "mcc", label: "MCC / manager account ID (if any)" },
  ],
  TikTok: [
    { key: "bcId", label: "TikTok Business Center ID", required: true },
    { key: "tiktokEmail", label: "Email to share the ad account with" },
    { key: "website", label: "Website or TikTok profile link", required: true, placeholder: "https://" },
  ],
  Snapchat: [
    { key: "orgId", label: "Snapchat Business / Organization ID", required: true },
    { key: "snapEmail", label: "Snapchat login email to share with" },
    { key: "website", label: "Website URL" },
  ],
};

// Selling price and top-up fee per platform, before any per-client override set by the admin.
export const DEFAULT_RATES: Record<string, { price: number; fee: number }> = {
  Meta_Europe: { price: 89, fee: 6 }, Meta_China: { price: 69, fee: 4 }, Google_Europe: { price: 69, fee: 8 },
  Google_China: { price: 49, fee: 6 }, TikTok: { price: 39, fee: 3 }, Snapchat: { price: 49, fee: 5 },
};
export const rateKey = (platform: string, region?: string) => ["Meta", "Google"].includes(platform) ? `${platform}_${region}` : platform;
export const rateFor = (client: RecordValue | undefined, platform: string, region?: string) => ({ ...DEFAULT_RATES[rateKey(platform, region)], ...(client?.pricingOverrides?.[rateKey(platform, region)] || {}) });

/** Records who did what and when; the first manager action also starts the "answered in" clock. */
export function stamp(item: RecordValue, event: { by: string; role: string; action: string; note?: string }, now: string) {
  (item.timeline ||= []).push({ at: now, ...event });
  if (event.role === "manager" && event.action !== "requested" && !item.managerRespondedAt) item.managerRespondedAt = now;
}

/** Applies one manager action to a client's request. Returns an error message, or null when the record was updated. */
export function applyTaskAction(state: CrmState, grant: Grant, body: { kind?: string; id?: string; action?: string; note?: string }, now: string): string | null {
  const kind = body.kind as TaskKind;
  const collection = TASK_KINDS[kind];
  if (!collection || !TASK_ACTIONS[kind].includes(String(body.action))) return "Choose a valid request and action.";
  const item = (state[collection] as RecordValue[]).find(x => x.id === body.id);
  if (!item || !scopedClientIds(state, grant).has(item.clientId)) return "This request is not assigned to you.";
  const note = String(body.note || "").trim();
  if (body.action === "reject" && note.length < 3) return "Write the reason for rejecting this request.";
  if (note.length > 300) return "The note is too long.";
  const by = grant.managerName || grant.email, action = body.action!;
  const payment = kind === "topup" ? state.payments.find(p => p.id === item.paymentId) : kind === "payment" ? item : null;
  const decide = (label: string) => { item.decidedAt = now; item.decidedBy = by; item.decision = label; };
  const clearDecision = () => { delete item.decidedAt; delete item.decidedBy; delete item.decision; delete item.rejectReason; };
  if (action === "reopen") {
    clearDecision();
    if (kind === "account") { item.managerStatus = "Open"; }
    else if (kind === "topup") { item.status = "Requested"; item.workflowSteps = { requestReceived: true }; delete item.completedAt; if (payment) { payment.status = "Pending"; delete payment.verifiedAt; } }
    else { item.status = "Pending"; delete item.verifiedAt; }
  } else if (kind === "account") {
    item.managerStatus = action === "start" ? "In progress" : action === "done" ? "Done" : "Rejected";
    if (action === "reject") { item.rejectReason = note; decide("Rejected"); } else if (action === "done") decide("Done");
  } else if (kind === "topup") {
    const steps = { requestReceived: true, ...(item.workflowSteps || {}) };
    if (action === "verify") { steps.paymentVerified = true; if (item.status !== "Completed") item.status = "Processing"; if (payment) { payment.status = "Verified"; payment.verifiedAt ||= now; } }
    if (action === "processing") { steps.paymentVerified = true; steps.supplierRequested = true; item.status = "Processing"; if (payment) { payment.status = "Verified"; payment.verifiedAt ||= now; } }
    if (action === "complete") { Object.assign(steps, { paymentVerified: true, supplierRequested: true, credited: true, confirmed: true }); item.status = "Completed"; item.completedAt ||= now; if (payment) { payment.status = "Verified"; payment.verifiedAt ||= now; } decide("Completed"); }
    if (action === "reject") { Object.assign(steps, { paymentVerified: false, supplierRequested: false, credited: false, confirmed: false }); item.status = "Rejected"; item.rejectReason = note; delete item.completedAt; if (payment) payment.status = "Rejected"; decide("Rejected"); }
    item.workflowSteps = steps;
  } else {
    if (action === "verify") { item.status = "Verified"; item.verifiedAt ||= now; decide("Verified"); }
    if (action === "reject") { item.status = "Rejected"; item.rejectReason = note; decide("Rejected"); }
  }
  stamp(item, { by, role: "manager", action, ...(note ? { note } : {}) }, now);
  (state.activity ||= []).unshift({ text: `${by} · ${kind} ${action === "reject" ? "rejected" : action}${note ? ` · ${note}` : ""}`, kind, recordId: item.id, clientId: item.clientId, createdAt: now });
  return null;
}

export function grantFor(state: CrmState, user: { email: string }): Grant | null {
  const email = user.email.trim().toLowerCase();
  const raw = (state.accessGrants || []).find(g => g.active && g.email?.trim().toLowerCase() === email);
  if (!raw || !["manager", "client"].includes(raw.role)) return null;
  if (raw.role === "client" && !state.clients.some(c => c.id === raw.clientId)) return null;
  if (raw.role === "manager" && !state.managers?.some(m => m.name === raw.managerName)) return null;
  const allowed: readonly string[] = raw.role === "manager" ? MANAGER_SECTIONS : CLIENT_SECTIONS;
  return { ...raw, email, permissions: (raw.permissions || []).filter(p => allowed.includes(p)) };
}

export function scopedClientIds(state: CrmState, grant: Grant): Set<string> {
  if (grant.role === "client") return new Set([grant.clientId!]);
  return new Set((grant.clientIds || []).filter(id => state.clients.some(c => c.id === id)));
}

const decisionOf = (x: RecordValue) => ({ managerStatus: x.managerStatus, rejectReason: x.rejectReason, respondedAt: x.managerRespondedAt, decidedAt: x.decidedAt });

export function portalProjection(state: CrmState, grant: Grant) {
  const ids = scopedClientIds(state, grant);
  const accounts = state.accounts.filter(a => ids.has(a.clientId));
  const accountIds = new Set(accounts.map(a => a.id));
  const topups = state.topups.filter(t => ids.has(t.clientId) && accountIds.has(t.accountId));
  const payments = state.payments.filter(p => ids.has(p.clientId) && (!p.accountId || accountIds.has(p.accountId)));
  const perms = new Set(grant.permissions);
  const proofUrl = (p?: RecordValue) => p?.proofKey ? `/api/proofs/${p.proofKey}` : null;
  const clientName = (id: string) => state.clients.find(c => c.id === id)?.business || "";
  const safeClient = (c: RecordValue) => ({ id:c.id, business:c.business, name:c.name, phone:c.phone, email:c.email, website:c.website, markets:c.markets, manager:c.manager });
  const safeAccount = (a: RecordValue) => ({ id:a.id, clientId:a.clientId, name:a.name, accountId:a.accountId, platform:a.platform, region:a.region, status:a.status, timezone:a.timezone, feePercent:a.feePercent, bmId:a.bmId, pageLinks:a.pageLinks, createdAt:a.createdAt, activatedAt:a.activatedAt, workflowStage:a.workflowStage, sellingPrice:a.workflow?.sellingPrice, ...decisionOf(a) });
  const safeTopup = (t: RecordValue) => ({ id:t.id, accountId:t.accountId, clientId:t.clientId, platform:t.platform, amount:t.amount, amountUsd:t.amountUsd, currency:t.currency, feePercent:t.feePercent, feeUsd:t.feeUsd, netUsd:t.netUsd, status:t.status, provider:t.provider, createdAt:t.createdAt, ...decisionOf(t) });
  const safePayment = (p: RecordValue) => ({ id:p.id, accountId:p.accountId, clientId:p.clientId, purpose:p.purpose, amount:p.amount, amountUsd:p.amountUsd, currency:p.currency, method:p.method, status:p.status, date:p.date, createdAt:p.createdAt, reference:p.reference, proof:p.proof, proofUrl:proofUrl(p), ...decisionOf(p) });
  const related = new Set([...ids, ...accountIds, ...topups.map(t=>t.id), ...payments.map(p=>p.id)]);
  const activity = (state.activity || []).filter(a => related.has(a.recordId) || ids.has(a.clientId)).map(a => ({ text:a.text, createdAt:a.createdAt, kind:a.kind }));
  const complete = topups.filter(t => t.status === "Completed");
  const overview = { clients:ids.size, accounts:accounts.length, activeAccounts:accounts.filter(a=>a.status==="Active").length, openRequests:accounts.filter(a=>["Requested","In setup"].includes(a.status)).length, completedTopups:complete.length, topupVolume:complete.reduce((n,t)=>n+Number(t.amountUsd||0),0), pendingPayments:payments.filter(p=>p.status==="Pending").length };
  const wantsForms = perms.has("requestAccounts") || perms.has("requestTopups") || perms.has("submitPayments");
  const taskState = (kind: TaskKind, x: RecordValue) => kind === "account" ? (x.managerStatus || "Open") : x.status === "Completed" || x.status === "Verified" ? "Done" : x.status === "Rejected" ? "Rejected" : x.status === "Processing" ? "In progress" : "Open";
  const tasks = grant.role === "manager" && perms.has("tasks") ? [
    ...state.accounts.filter(a => ids.has(a.clientId) && (["Requested", "In setup"].includes(a.status) || a.managerStatus)).map(a => ({
      kind:"account", id:a.id, clientId:a.clientId, title:a.name, detail:`${a.platform}${a.region ? ` · ${a.region}` : ""} account`, agencyStatus:a.status, state:taskState("account", a),
      by:a.requestedBy || "", createdAt:a.createdAt, respondedAt:a.managerRespondedAt, decidedAt:a.decidedAt, rejectReason:a.rejectReason, fields:a.requestFields || null, timezone:a.timezone, notes:a.workflow?.requestNotes || "" })),
    ...state.topups.filter(t => ids.has(t.clientId)).map(t => { const pay = state.payments.find(p => p.id === t.paymentId); return {
      kind:"topup", id:t.id, clientId:t.clientId, title:`Top-up $${t.amountUsd}`, detail:`${t.accountName || ""} · fee ${t.feePercent ?? 0}% · net $${t.netUsd ?? ""}`, agencyStatus:t.status, state:taskState("topup", t),
      by:t.requestedBy || "", createdAt:t.createdAt, respondedAt:t.managerRespondedAt, decidedAt:t.decidedAt, rejectReason:t.rejectReason,
      amount:t.amount, currency:t.currency, method:t.provider || pay?.method || "", reference:pay?.reference || "", proofUrl:proofUrl(pay), proofName:pay?.proof || "", paymentStatus:pay?.status || "" }; }),
    ...state.payments.filter(p => ids.has(p.clientId) && !p.topupId && (p.source === "portal" || p.status === "Pending")).map(p => ({
      kind:"payment", id:p.id, clientId:p.clientId, title:`Payment proof $${p.amountUsd}`, detail:`${p.method || "Payment"}${p.accountId ? ` · ${state.accounts.find(a => a.id === p.accountId)?.name || ""}` : ""}`, agencyStatus:p.status, state:taskState("payment", p),
      by:p.requestedBy || "", createdAt:p.createdAt, respondedAt:p.managerRespondedAt, decidedAt:p.decidedAt, rejectReason:p.rejectReason,
      amount:p.amount, currency:p.currency, method:p.method || "", reference:p.reference || "", proofUrl:proofUrl(p), proofName:p.proof || "", paymentStatus:p.status })),
  ].map(t => ({ ...t, clientName:clientName(t.clientId) })).sort((x, y) => (x.state === "Done" || x.state === "Rejected" ? 1 : 0) - (y.state === "Done" || y.state === "Rejected" ? 1 : 0) || String(y.createdAt).localeCompare(String(x.createdAt))).slice(0, 300) : [];
  return {
    role:grant.role, email:grant.email, permissions:grant.permissions,
    label:grant.role === "client" ? state.clients.find(c=>c.id===grant.clientId)?.business || "Client" : grant.managerName || "Manager",
    manager:grant.role === "client" ? state.clients.find(c=>c.id===grant.clientId)?.manager || "" : grant.managerName || "",
    overview:perms.has("overview") ? overview : null,
    clients:perms.has("clients") ? state.clients.filter(c=>ids.has(c.id)).map(safeClient) : [],
    ownClient:grant.role === "client" ? safeClient(state.clients.find(c=>c.id===grant.clientId)!) : null,
    accounts:perms.has("accounts") ? accounts.map(safeAccount) : [],
    requestAccounts:perms.has("requestAccounts") ? accounts.map(a=>({id:a.id,name:a.name,clientId:a.clientId})) : [],
    platformFields:perms.has("requestAccounts") ? PLATFORM_FIELDS : {},
    requestClients:wantsForms ? state.clients.filter(c=>ids.has(c.id)).map(c=>({id:c.id,business:c.business,rates:Object.fromEntries(Object.keys(DEFAULT_RATES).map(k=>[k,{...DEFAULT_RATES[k],...(c.pricingOverrides?.[k]||{})}]))})) : [],
    requestTopupAccounts:perms.has("requestTopups") ? accounts.filter(a=>a.status==="Active").map(a=>({id:a.id,name:a.name,clientId:a.clientId,platform:a.platform,accountId:a.accountId,feePercent:a.feePercent})) : [],
    paymentAccounts:perms.has("submitPayments") ? accounts.map(a=>({id:a.id,name:a.name,clientId:a.clientId})) : [],
    paymentMethods:perms.has("requestTopups")||perms.has("submitPayments") ? ((state.receivingMethods||[]) as RecordValue[]).filter((m:RecordValue)=>!m.demo&&!((state.disabledMethods||[]) as string[]).includes(m.name)).map((m:RecordValue)=>({id:m.id,name:m.name,holder:m.holder,details:m.details,currency:m.currency,country:m.country,instructions:m.instructions})) : [],
    tasks,
    topups:perms.has("topups") ? topups.map(safeTopup) : [],
    payments:perms.has("payments") ? payments.map(safePayment) : [],
    academy:perms.has("academy") ? (state.academy||[]).map(a=>({ id:a.id, title:a.title, topic:a.topic, url:/^https?:\/\//i.test(a.url||"")?a.url:"", notes:a.notes })) : [],
    activity:perms.has("activity") ? activity : [],
  };
}
