import { env } from "cloudflare:workers";
import { privateJson,sameOrigin } from "@/lib/admin";
import { portalContext,saveCrm,scopedClientIds,stamp } from "@/lib/portal";

// A manager adds a new client. The client is assigned to that manager, flagged for the admin, and the admin sets pricing and login.
export async function POST(request:Request){
  if(!sameOrigin(request))return privateJson({error:"Invalid origin."},403);
  try{
    const {user,record,grant}=await portalContext();
    if(!user||!record||!grant||grant.role!=="manager"||!grant.permissions.includes("addClients"))return privateJson({error:"Adding clients is not available for this login."},403);
    const raw=await request.text();if(raw.length>4000)return privateJson({error:"Details are too large."},413);
    let body:Record<string,unknown>;try{body=JSON.parse(raw)}catch{return privateJson({error:"Invalid input."},400)}
    const text=(k:string,max=300)=>String(body?.[k]??"").trim().slice(0,max);
    const value={name:text("name"),business:text("business"),phone:text("phone",60),email:text("email"),website:text("website"),markets:text("markets"),notes:text("notes",1000)};
    if(!value.name||!value.business||!value.phone)return privateJson({error:"Client name, business name and phone are required."},400);
    if(value.email&&!/^\S+@\S+\.\S+$/.test(value.email))return privateJson({error:"Enter a valid client email."},400);
    if(value.website&&!/^https?:\/\//i.test(value.website))return privateJson({error:"The website must start with http:// or https://"},400);
    const state=record.state,now=new Date().toISOString();
    if(state.clients.some(c=>c.business.trim().toLowerCase()===value.business.toLowerCase()))return privateJson({error:"A client with this business name already exists."},409);
    const client={id:`c${crypto.randomUUID()}`,name:value.name,business:value.business,phone:value.phone,email:value.email,website:value.website,markets:value.markets,manager:grant.managerName,createdAt:now,source:"portal",addedBy:grant.managerName,addedByEmail:user.email,managerNotes:value.notes,needsAdminReview:true};
    stamp(client,{by:grant.managerName||user.email,role:"manager",action:"requested"},now);
    state.clients.unshift(client);
    // The manager keeps seeing only assigned clients, so the new one is added to every login of this manager.
    for(const g of state.accessGrants||[])if(g.role==="manager"&&g.managerName===grant.managerName)g.clientIds=[...new Set([...(g.clientIds||[]),client.id])];
    (state.activity ||= []).unshift({text:`New client added by ${grant.managerName} · ${client.business}`,kind:"client",recordId:client.id,clientId:client.id,createdAt:now});
    const saved=await saveCrm(record,now);
    return saved.ok?privateJson({created:client.id},201):privateJson({error:saved.error},saved.status);
  }catch(error){console.error("Portal client creation failed",error);return privateJson({error:"Could not add this client. Try again."},503)}
}

export async function PATCH(request:Request){
  if(!sameOrigin(request))return privateJson({error:"Invalid origin."},403);
  const {user,record,grant}=await portalContext();
  if(!user||!record||!grant||grant.role!=="manager"||!grant.permissions.includes("clients"))return privateJson({error:"Manager client access required."},403);
  const db=env.DB;if(!db)return privateJson({error:"CRM database unavailable."},503);
  const raw=await request.text();if(raw.length>3000)return privateJson({error:"Changes too large."},400);
  let body:{id?:string;name?:string;phone?:string;email?:string;website?:string;markets?:string};try{body=JSON.parse(raw)}catch{return privateJson({error:"Invalid input."},400)}
  if(!body?.id||!scopedClientIds(record.state,grant).has(body.id))return privateJson({error:"Client not assigned."},403);
  const fields=["name","phone","email","website","markets"] as const;
  if(fields.some(k=>typeof body[k]!=="string"||body[k]!.length>300)||!body.name?.trim()||!/^\S+@\S+\.\S+$/.test(body.email||""))return privateJson({error:"Check the client details."},400);
  const client=record.state.clients.find(c=>c.id===body.id)!;
  for(const field of fields)client[field]=body[field]!.trim();
  const now=new Date().toISOString();record.state.activity||=[];record.state.activity.unshift({text:`Client details updated · ${client.business}`,kind:"client",recordId:client.id,clientId:client.id,createdAt:now});
  const saved=await saveCrm(record,now);
  return saved.ok?privateJson({ok:true}):privateJson({error:saved.error},saved.status);
}
