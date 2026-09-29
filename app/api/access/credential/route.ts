import { env } from "cloudflare:workers";
import { isAdmin,privateJson,sameOrigin } from "@/lib/admin";
import { hashPassword,normalizeEmail,revokeSessions,validPassword } from "@/lib/crm-auth";
export async function GET(){if(!await isAdmin())return privateJson({error:"Admin access required."},403);const rows=await env.DB?.prepare("SELECT email FROM crm_users WHERE role IN ('manager','client')").all<{email:string}>();return privateJson({emails:(rows?.results||[]).map(r=>r.email)});}
export async function POST(request:Request){
  if(!await isAdmin())return privateJson({error:"Admin access required."},403);
  if(!sameOrigin(request))return privateJson({error:"Invalid origin."},403);
  const db=env.DB;if(!db)return privateJson({error:"CRM database unavailable."},503);
  const raw=await request.text();if(raw.length>2000)return privateJson({error:"Invalid input."},400);
  let body:{email?:string;password?:string;role?:string};try{body=JSON.parse(raw)}catch{return privateJson({error:"Invalid input."},400)}
  const email=normalizeEmail(String(body?.email||""));
  if(!/^\S+@\S+\.\S+$/.test(email)||email.length>254||!["manager","client"].includes(body?.role||"")||!validPassword(String(body?.password||"")))return privateJson({error:"Enter a valid email and password of 12–128 characters."},400);
  const existing=await db.prepare("SELECT role FROM crm_users WHERE email = ?").bind(email).first<{role:string}>();
  if(existing?.role==="admin")return privateJson({error:"Admin credentials cannot be changed here."},403);
  const now=new Date().toISOString(),hash=await hashPassword(body.password!);
  await db.prepare("INSERT INTO crm_users(email,role,password_hash,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET role=excluded.role,password_hash=excluded.password_hash,updated_at=excluded.updated_at")
    .bind(email,body.role,hash,now,now).run();
  await revokeSessions(email);
  return privateJson({ok:true});
}
