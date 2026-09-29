import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { isOwnerIdentity,privateJson,sameOrigin } from "@/lib/admin";
import { createSession,hashPassword,normalizeEmail,validPassword } from "@/lib/crm-auth";
export async function POST(request:Request){
  if(!sameOrigin(request))return privateJson({error:"Invalid origin."},403);
  const owner=await getChatGPTUser();if(!isOwnerIdentity(owner))return privateJson({error:"Only the verified Site owner can set up Admin."},403);
  const db=env.DB;if(!db)return privateJson({error:"CRM database unavailable."},503);
  const exists=await db.prepare("SELECT 1 FROM crm_users WHERE role = 'admin' LIMIT 1").first();if(exists)return privateJson({error:"Admin is already set up. Sign in with the CRM password."},409);
  const raw=await request.text();if(raw.length>2000)return privateJson({error:"Invalid input."},400);
  let body:{email?:string;password?:string};try{body=JSON.parse(raw)}catch{return privateJson({error:"Invalid input."},400)}
  const email=normalizeEmail(String(body?.email||""));if(email!==normalizeEmail(owner!.email)||!validPassword(String(body.password||"")))return privateJson({error:"Use your verified owner email and a password of 12–128 characters."},400);
  const now=new Date().toISOString();const hash=await hashPassword(body.password!);
  const inserted=await db.prepare("INSERT OR IGNORE INTO crm_users(email,role,password_hash,created_at,updated_at) VALUES (?,'admin',?,?,?)").bind(email,hash,now,now).run();
  if(!inserted.meta.changes)return privateJson({error:"This email already belongs to a CRM account."},409);
  await createSession(email);return privateJson({redirect:"/"},201);
}
