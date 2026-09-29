export const MANAGER_SECTIONS = ["overview", "clients", "accounts", "topups", "payments", "academy", "activity", "requestAccounts", "requestTopups", "submitPayments", "tasks"] as const;
export const CLIENT_SECTIONS = ["overview", "accounts", "topups", "payments", "academy", "activity", "requestAccounts", "requestTopups", "submitPayments"] as const;
export type Section = (typeof MANAGER_SECTIONS)[number];
export const TASK_STATUSES = ["Open", "In progress", "Done"] as const;
export const TASK_KINDS = { account: "accounts", topup: "topups", payment: "payments" } as const;
export type Grant = { email: string; role: "manager" | "client"; clientId?: string; managerName?: string; clientIds?: string[]; permissions: Section[]; active: boolean };
export type RecordValue = Record<string, any>;
export type CrmState = RecordValue & { clients: RecordValue[]; accounts: RecordValue[]; payments: RecordValue[]; topups: RecordValue[]; academy?: RecordValue[]; activity?: RecordValue[]; managers?: RecordValue[]; accessGrants?: Grant[] };

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

export function portalProjection(state: CrmState, grant: Grant) {
  const ids = scopedClientIds(state, grant);
  const accounts = state.accounts.filter(a => ids.has(a.clientId));
  const accountIds = new Set(accounts.map(a => a.id));
  const topups = state.topups.filter(t => ids.has(t.clientId) && accountIds.has(t.accountId));
  const payments = state.payments.filter(p => ids.has(p.clientId) && (!p.accountId || accountIds.has(p.accountId)));
  const perms = new Set(grant.permissions);
  const safeClient = (c: RecordValue) => ({ id:c.id, business:c.business, name:c.name, phone:c.phone, email:c.email, website:c.website, markets:c.markets, manager:c.manager });
  const safeAccount = (a: RecordValue) => ({ id:a.id, clientId:a.clientId, name:a.name, accountId:a.accountId, platform:a.platform, region:a.region, status:a.status, timezone:a.timezone, feePercent:a.feePercent, bmId:a.bmId, pageLinks:a.pageLinks, createdAt:a.createdAt, activatedAt:a.activatedAt, workflowStage:a.workflowStage, managerStatus:a.managerStatus, sellingPrice:a.workflow?.sellingPrice });
  const safeTopup = (t: RecordValue) => ({ id:t.id, accountId:t.accountId, clientId:t.clientId, platform:t.platform, amount:t.amount, amountUsd:t.amountUsd, currency:t.currency, feeUsd:t.feeUsd, netUsd:t.netUsd, status:t.status, provider:t.provider, managerStatus:t.managerStatus, createdAt:t.createdAt });
  const safePayment = (p: RecordValue) => ({ id:p.id, accountId:p.accountId, clientId:p.clientId, purpose:p.purpose, amount:p.amount, amountUsd:p.amountUsd, currency:p.currency, method:p.method, status:p.status, date:p.date, createdAt:p.createdAt, reference:p.reference, managerStatus:p.managerStatus, proof:p.proof, proofUrl:p.proofKey?`/api/proofs/${p.proofKey}`:null });
  const related = new Set([...ids, ...accountIds, ...topups.map(t=>t.id), ...payments.map(p=>p.id)]);
  const activity = (state.activity || []).filter(a => related.has(a.recordId) || ids.has(a.clientId)).map(a => ({ text:a.text, createdAt:a.createdAt, kind:a.kind }));
  const complete = topups.filter(t => t.status === "Completed");
  const overview = { clients:ids.size, accounts:accounts.length, activeAccounts:accounts.filter(a=>a.status==="Active").length, openRequests:accounts.filter(a=>["Requested","In setup"].includes(a.status)).length, completedTopups:complete.length, topupVolume:complete.reduce((n,t)=>n+Number(t.amountUsd||0),0), pendingPayments:payments.filter(p=>p.status==="Pending").length };
  return {
    role:grant.role, email:grant.email, permissions:grant.permissions,
    label:grant.role === "client" ? state.clients.find(c=>c.id===grant.clientId)?.business || "Client" : grant.managerName || "Manager",
    overview:perms.has("overview") ? overview : null,
    clients:perms.has("clients") ? state.clients.filter(c=>ids.has(c.id)).map(safeClient) : [],
    ownClient:grant.role === "client" ? safeClient(state.clients.find(c=>c.id===grant.clientId)!) : null,
    accounts:perms.has("accounts") ? accounts.map(safeAccount) : [],
    requestAccounts:perms.has("requestAccounts") ? accounts.map(a=>({id:a.id,name:a.name,clientId:a.clientId})) : [],
    requestClients:perms.has("requestAccounts")||perms.has("requestTopups")||perms.has("submitPayments") ? state.clients.filter(c=>ids.has(c.id)).map(c=>({id:c.id,business:c.business})) : [],
    requestTopupAccounts:perms.has("requestTopups") ? accounts.filter(a=>a.status==="Active").map(a=>({id:a.id,name:a.name,clientId:a.clientId,platform:a.platform,accountId:a.accountId,feePercent:a.feePercent})) : [],
    paymentAccounts:perms.has("submitPayments") ? accounts.map(a=>({id:a.id,name:a.name,clientId:a.clientId})) : [],
    paymentMethods:perms.has("requestTopups")||perms.has("submitPayments") ? ((state.receivingMethods||[]) as RecordValue[]).filter((m:RecordValue)=>!m.demo&&!((state.disabledMethods||[]) as string[]).includes(m.name)).map((m:RecordValue)=>({id:m.id,name:m.name,holder:m.holder,details:m.details,currency:m.currency,country:m.country,instructions:m.instructions})) : [],
    tasks:grant.role==="manager"&&perms.has("tasks") ? [
      ...state.accounts.filter(a=>ids.has(a.clientId)&&["Requested","In setup"].includes(a.status)).map(a=>({kind:"account",id:a.id,clientId:a.clientId,title:a.name,detail:`${a.platform} account · ${a.status}`,managerStatus:a.managerStatus||"Open",by:a.requestedBy||"",createdAt:a.createdAt})),
      ...state.topups.filter(t=>ids.has(t.clientId)&&!["Completed","Rejected"].includes(t.status)).map(t=>({kind:"topup",id:t.id,clientId:t.clientId,title:`Top-up $${t.amountUsd} · ${t.accountName||""}`,detail:`${t.platform||""} top-up · ${t.status}`,managerStatus:t.managerStatus||"Open",by:t.requestedBy||"",createdAt:t.createdAt})),
      ...state.payments.filter(p=>ids.has(p.clientId)&&p.status==="Pending"&&!p.topupId).map(p=>({kind:"payment",id:p.id,clientId:p.clientId,title:`Payment proof $${p.amountUsd}`,detail:`${p.method||"Payment"} · Pending verification`,managerStatus:p.managerStatus||"Open",by:p.requestedBy||"",createdAt:p.createdAt})),
    ].sort((x,y)=>String(y.createdAt).localeCompare(String(x.createdAt))) : [],
    topups:perms.has("topups") ? topups.map(safeTopup) : [],
    payments:perms.has("payments") ? payments.map(safePayment) : [],
    academy:perms.has("academy") ? (state.academy||[]).map(a=>({ id:a.id, title:a.title, topic:a.topic, url:/^https?:\/\//i.test(a.url||"")?a.url:"", notes:a.notes })) : [],
    activity:perms.has("activity") ? activity : [],
  };
}
