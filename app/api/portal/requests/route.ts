import { env } from "cloudflare:workers";
import { privateJson, sameOrigin } from "@/lib/admin";
import { portalContext, scopedClientIds } from "@/lib/portal";

const PLATFORMS = new Set(["Meta","TikTok","Google","Snapchat"]);
type RequestItem = { platform:string; count:number; region?:string; bmId?:string; pages?:string[] };

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
    const client = record.state.clients.find(c=>c.id===clientId);
    if (!client || !scopedClientIds(record.state, grant).has(clientId!) || !Array.isArray(body.items) || !body.items.length || body.items.length>4 ||
      body.items.some(i=>!i || typeof i!=="object" || !PLATFORMS.has(i.platform) || !Number.isSafeInteger(i.count) || i.count<1 || i.count>5 ||
        (!["Meta","Google"].includes(i.platform) && !!i.region) ||
        (["Meta","Google"].includes(i.platform) && !["Europe","China"].includes(i.region||"")) ||
        String(i.bmId||"").length>100 || !Array.isArray(i.pages) || i.pages.length>10 || i.pages.some(p=>typeof p!=="string" || p.length>400)) ||
      body.items.reduce((n,i)=>n+i.count,0)>10 || String(body.notes||"").length>500 || String(body.timezone||"").length>100) {
      return privateJson({ error:"Check the platform, account count, region and page links." }, 400);
    }
    const now = new Date().toISOString();
    const date = now.slice(0,10);
    const accounts = body.items.flatMap(item=>Array.from({length:item.count},(_,index)=>{
      const existing = record.state.accounts.filter(a=>a.clientId===clientId && a.platform===item.platform).length;
      const key = ["Meta","Google"].includes(item.platform)?`${item.platform}_${item.region}`:item.platform;
      const defaults:Record<string,{price:number;fee:number}>={Meta_Europe:{price:89,fee:6},Meta_China:{price:69,fee:4},Google_Europe:{price:69,fee:8},Google_China:{price:49,fee:6},TikTok:{price:39,fee:3},Snapchat:{price:49,fee:5}};
      const rate = {...defaults[key],...(client.pricingOverrides?.[key]||{})};
      return { id:`a${crypto.randomUUID()}`, clientId, name:`${client.business} · ${item.platform} ${String(existing+index+1).padStart(2,"0")} · ${date}`, accountId:"", platform:item.platform,
        bmId:item.bmId||"", region:item.region||"", timezone:body.timezone||"Africa/Casablanca", pageLinks:item.platform==="Meta"?item.pages:[], requestedPages:item.platform==="Meta"?item.pages!.length:0,
        feePercent:Number(rate.fee)||0, manager:client.manager||"Unassigned", source:"portal", requestedBy:user.email, requestedRole:grant.role, status:"Requested", workflowStage:"new", workflow:{sellingPrice:Number(rate.price)||0, accountType:`${item.platform} · ${item.region||"Standard"}`, requestNotes:body.notes||"", requestedBy:"client portal"}, createdAt:now };
    }));
    const state = record.state;
    state.accounts.unshift(...accounts);
    state.activity ||= [];
    state.activity.unshift({text:`Account request submitted · ${client.business} · ${accounts.length} account${accounts.length===1?"":"s"}`,kind:"client",recordId:clientId,clientId,createdAt:now});
    const db = env.DB;
    if (!db) return privateJson({ error:"CRM database is unavailable." },503);
    const payload = JSON.stringify(state);
    if (payload.length > 1_000_000) return privateJson({ error:"CRM storage is full. Ask the admin to export and review old records." },413);
    const result = await db.prepare("UPDATE crm_state SET payload = ?, revision = revision + 1, updated_at = ? WHERE user_id = ? AND revision = ?")
      .bind(payload,now,"b0aa3e25-9698-4d28-b18d-0b27a3cfb643",record.revision).run();
    if (!result.meta.changes) return privateJson({ error:"Records changed while sending your request. Refresh and try again." },409);
    return privateJson({ created:accounts.length },201);
  } catch (error) {
    console.error("Portal account request failed", error);
    return privateJson({ error:"Could not send this request. Try again." },503);
  }
}
