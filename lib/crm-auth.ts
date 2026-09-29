import { env } from "cloudflare:workers";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "__Host-adsolution_session";
const SESSION_DAYS = 7;
// The Worker Web Crypto runtime caps one PBKDF2 call at 100,000 iterations.
// Run three independent chained derivations, each within that limit.
const ITERATIONS = 100_000;
const ROUNDS = 3;
type User = { email:string; role:"admin"|"manager"|"client" };
const hex = (bytes:Uint8Array) => Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
const unhex = (s:string) => new Uint8Array(s.match(/../g)?.map(b=>parseInt(b,16))||[]);
export const normalizeEmail = (email:string) => email.trim().toLowerCase();
export async function sha256(text:string) { return hex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text)))); }
async function derive(password:string,salt:Uint8Array,iterations:number) {
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",salt:new Uint8Array(salt),iterations,hash:"SHA-256"},key,256));
}
async function chained(password:string,salt:Uint8Array,iterations:number,rounds:number){
  let material=password;
  let result=new Uint8Array(32);
  for(let i=0;i<rounds;i++){
    const roundSalt=new Uint8Array([...salt,i]);
    result=await derive(material,roundSalt,iterations);
    material=hex(result);
  }
  return result;
}
export async function hashPassword(password:string) {
  const salt=crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2c$${ITERATIONS}$${ROUNDS}$${hex(salt)}$${hex(await chained(password,salt,ITERATIONS,ROUNDS))}`;
}
export async function verifyPassword(password:string,stored:string) {
  const parts=stored.split("$");
  if(parts.length!==5||parts[0]!=="pbkdf2c"||parts[1]!=="100000"||parts[2]!=="3"||!/^[0-9a-f]{32}$/.test(parts[3])||!/^[0-9a-f]{64}$/.test(parts[4]))return false;
  const expected=unhex(parts[4]);const actual=await chained(password,unhex(parts[3]),ITERATIONS,ROUNDS);
  let difference=0;for(let i=0;i<expected.length;i++)difference|=expected[i]^actual[i];return difference===0;
}
export function validPassword(p:string){return p.length>=12 && p.length<=128;}
export async function getAuthUser():Promise<User|null> {
  const token=(await cookies()).get(SESSION_COOKIE)?.value;
  if(!token||!/^[0-9a-f]{64}$/.test(token)||!env.DB)return null;
  const row=await env.DB.prepare("SELECT u.email, u.role FROM crm_sessions s JOIN crm_users u ON u.email = s.email WHERE s.token_hash = ? AND s.expires_at > ?")
    .bind(await sha256(token),new Date().toISOString()).first<User>();
  return row && ["admin","manager","client"].includes(row.role)?row:null;
}
export async function createSession(email:string) {
  if(!env.DB)throw new Error("CRM database unavailable");
  const token=hex(crypto.getRandomValues(new Uint8Array(32)));
  const now=new Date();
  await env.DB.prepare("INSERT INTO crm_sessions (token_hash,email,expires_at,created_at) VALUES (?,?,?,?)")
    .bind(await sha256(token),normalizeEmail(email),new Date(now.getTime()+SESSION_DAYS*864e5).toISOString(),now.toISOString()).run();
  (await cookies()).set(SESSION_COOKIE,token,{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:SESSION_DAYS*86400});
}
export async function clearSession(){
  const jar=await cookies();const token=jar.get(SESSION_COOKIE)?.value;
  if(token&&env.DB)await env.DB.prepare("DELETE FROM crm_sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  jar.delete(SESSION_COOKIE);
}
export async function revokeSessions(email:string){if(env.DB)await env.DB.prepare("DELETE FROM crm_sessions WHERE email = ?").bind(normalizeEmail(email)).run();}
export function safeNext(path:string|undefined,role:User["role"]){
  const fallback=role==="admin"?"/":`/portal/${role}`;
  if(!path||!path.startsWith("/")||path.startsWith("//"))return fallback;
  const url=new URL(path,"https://crm.local");
  if(url.origin!=="https://crm.local"||!(["/","/access","/portal/client","/portal/manager"].includes(url.pathname)))return fallback;
  if(role!=="admin" && url.pathname!==`/portal/${role}`)return fallback;
  return url.pathname;
}
