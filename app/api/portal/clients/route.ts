import { env } from "cloudflare:workers";
import { privateJson,sameOrigin } from "@/lib/admin";
import { portalContext,scopedClientIds } from "@/lib/portal";
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
  const payload=JSON.stringify(record.state);if(payload.length>1_000_000)return privateJson({error:"CRM storage is full."},413);
  const result=await db.prepare("UPDATE crm_state SET payload=?, revision=revision+1, updated_at=? WHERE user_id=? AND revision=?")
    .bind(payload,now,"b0aa3e25-9698-4d28-b18d-0b27a3cfb643",record.revision).run();
  if(!result.meta.changes)return privateJson({error:"Records changed in another tab. Refresh and try again."},409);
  return privateJson({ok:true});
}
