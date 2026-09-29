import { privateJson, sameOrigin } from "@/lib/admin";
import { PLATFORM_FIELDS, portalContext, rateFor, saveCrm, scopedClientIds, stamp } from "@/lib/portal";

type RequestItem = { platform:string; count:number; region?:string; fields?:Record<string,string> };

export async function POST(request: Request) {
  if (!sameOrigin(request)) return privateJson({ error:"Invalid request origin." }, 403);
  try {
    const { user, record, grant } = await portalContext();
    if (!user || user.role === "admin" || !record || !grant || !grant.permissions.includes("requestAccounts")) return privateJson({ error:"Account requests are not available for this login." }, 403);
    const raw = await request.text();
    if (raw.length > 20_000) return privateJson({ error:"Request is too large." },413);
    let body: { clientId?:string; items?:RequestItem[]; timezone?:string; notes?:string };
    try { body = JSON.parse(raw); } catch { return privateJson({ error:"Invalid request." },400); }
    if (!body || typeof body !== "object") return privateJson({ error:"Invalid request." },400);
    const clientId = grant.role === "client" ? grant.clientId : body.clientId;
    const state = record.state;
    const client = state.clients.find(c=>c.id===clientId);
    if (!client || !scopedClientIds(state, grant).has(clientId!) || !Array.isArray(body.items) || !body.items.length || body.items.length>4 ||
      body.items.reduce((n,i)=>n+(Number(i?.count)||0),0)>10 || String(body.notes||"").length>500 || String(body.timezone||"").length>100) {
      return privateJson({ error:"Check the platforms and the number of accounts." }, 400);
    }
    // Every platform has its own required information; reject the request before it reaches the agency if any is missing.
    for (const i of body.items) {
      const spec = i && typeof i === "object" ? PLATFORM_FIELDS[i.platform] : undefined;
      if (!spec || !Number.isSafeInteger(i.count) || i.count<1 || i.count>5) return privateJson({ error:"Check the platform and account count." }, 400);
      const wantsRegion = ["Meta","Google"].includes(i.platform);
      if ((!wantsRegion && !!i.region) || (wantsRegion && !["Europe","China"].includes(i.region||""))) return privateJson({ error:`Choose the ${i.platform} account origin.` }, 400);
      const fields = i.fields && typeof i.fields === "object" ? i.fields : {};
      for (const f of spec) {
        const value = String(fields[f.key] ?? "").trim();
        if (value.length > (f.list ? 2000 : 300)) return privateJson({ error:`${f.label} is too long.` }, 400);
        if (f.required && !value) return privateJson({ error:`${i.platform}: ${f.label} is required.` }, 400);
        if (f.list && value.split(/\n/).map(x=>x.trim()).filter(Boolean).length > 10) return privateJson({ error:`${i.platform}: at most 10 links.` }, 400);
      }
    }
    const now = new Date().toISOString();
    const date = now.slice(0,10);
    const accounts = body.items.flatMap(item=>Array.from({length:item.count},(_,index)=>{
      const existing = state.accounts.filter(a=>a.clientId===clientId && a.platform===item.platform).length;
      const rate = rateFor(client, item.platform, item.region);
      const info = Object.fromEntries(PLATFORM_FIELDS[item.platform].map(f=>[f.key, String(item.fields?.[f.key] ?? "").trim()]));
      const pages = String(info.pages||"").split(/\n/).map(x=>x.trim()).filter(Boolean);
      const account = { id:`a${crypto.randomUUID()}`, clientId, name:`${client.business} · ${item.platform} ${String(existing+index+1).padStart(2,"0")} · ${date}`, accountId:"", platform:item.platform,
        bmId:info.bmId||info.bcId||info.orgId||"", region:item.region||"", timezone:body.timezone||"Africa/Casablanca", pageLinks:item.platform==="Meta"?pages:[], requestedPages:item.platform==="Meta"?pages.length:0,
        requestFields:{...info, ...(item.platform==="Meta"?{pages:pages.join("\n")}:{})},
        feePercent:Number(rate.fee)||0, manager:client.manager||"Unassigned", source:"portal", requestedBy:user.email, requestedRole:grant.role, status:"Requested", workflowStage:"new",
        workflow:{sellingPrice:Number(rate.price)||0, accountType:`${item.platform} · ${item.region||"Standard"}`, requestNotes:body.notes||"", requestedBy:"client portal"}, createdAt:now };
      stamp(account, { by:user.email, role:grant.role, action:"requested" }, now);
      return account;
    }));
    state.accounts.unshift(...accounts);
    (state.activity ||= []).unshift({text:`Account request submitted · ${client.business} · ${accounts.length} account${accounts.length===1?"":"s"}`,kind:"client",recordId:clientId,clientId,createdAt:now});
    const saved = await saveCrm(record, now);
    return saved.ok ? privateJson({ created:accounts.length },201) : privateJson({ error:saved.error }, saved.status);
  } catch (error) {
    console.error("Portal account request failed", error);
    return privateJson({ error:"Could not send this request. Try again." },503);
  }
}
