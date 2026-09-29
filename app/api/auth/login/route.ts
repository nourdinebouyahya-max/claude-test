import { env } from "cloudflare:workers";
import { privateJson, sameOrigin } from "@/lib/admin";
import { createSession, normalizeEmail, safeNext, sha256, verifyPassword } from "@/lib/crm-auth";
import { readCrm, grantFor } from "@/lib/portal";

export async function POST(request:Request) {
  if(!sameOrigin(request)||!request.headers.get("content-type")?.startsWith("application/json"))return privateJson({error:"Invalid login request."},403);
  const db=env.DB;if(!db)return privateJson({error:"CRM is temporarily unavailable."},503);
  const raw=await request.text();if(raw.length>2000)return privateJson({error:"Invalid login request."},400);
  let body:{email?:string;password?:string;next?:string};try{body=JSON.parse(raw)}catch{return privateJson({error:"Invalid login request."},400)}
  const email=normalizeEmail(String(body?.email||"")),password=body?.password;
  if(email.length>254||!/^\S+@\S+\.\S+$/.test(email)||typeof password!=="string"||password.length>128)return privateJson({error:"Invalid email or password."},401);
  const ip=request.headers.get("cf-connecting-ip")||"unknown";
  const key=await sha256(email+":"+ip),now=new Date(),windowStart=new Date(now.getTime()-15*60_000).toISOString();
  try {
    const attempt=await db.prepare("SELECT failures,window_start,locked_until FROM crm_login_attempts WHERE key = ?").bind(key).first<{failures:number;window_start:string;locked_until:string|null}>();
    if(attempt?.locked_until && attempt.locked_until>now.toISOString())return privateJson({error:"Too many attempts. Try again in 15 minutes."},429);
    const user=await db.prepare("SELECT email,role,password_hash FROM crm_users WHERE email = ?").bind(email).first<{email:string;role:"admin"|"client"|"manager";password_hash:string}>();
    const verified=await verifyPassword(password,user?.password_hash||"pbkdf2c$100000$3$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000");
    const record=user?.role!=="admin"?await readCrm():null;
    const grant=user?.role!=="admin" && user && record ? grantFor(record.state,user):null;
    if(!user||!verified||(user.role!=="admin" && (!grant||grant.role!==user.role))){
      const count=attempt && attempt.window_start>windowStart?attempt.failures+1:1;
      await db.prepare("INSERT INTO crm_login_attempts (key,failures,window_start,locked_until) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET failures=excluded.failures,window_start=excluded.window_start,locked_until=excluded.locked_until")
        .bind(key,count,count===1?now.toISOString():attempt!.window_start,count>=8?new Date(now.getTime()+15*60_000).toISOString():null).run();
      return privateJson({error:"Invalid email or password, or access is disabled."},401);
    }
    await db.prepare("DELETE FROM crm_login_attempts WHERE key = ?").bind(key).run();
    await createSession(email);
    return privateJson({role:user.role,redirect:safeNext(body.next,user.role)});
  }catch(error){console.error("CRM login failed",error);return privateJson({error:"Login is temporarily unavailable."},503)}
}
