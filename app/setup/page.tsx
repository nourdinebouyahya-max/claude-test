import { env } from "cloudflare:workers";
import { redirect } from "next/navigation";
import { getChatGPTUser,chatGPTSignInPath } from "@/app/chatgpt-auth";
import { isOwnerIdentity } from "@/lib/admin";
import SetupForm from "./setup-form";
import "../login/login.css";
export const dynamic="force-dynamic";
export default async function Setup(){
  const existing=await env.DB?.prepare("SELECT 1 FROM crm_users WHERE role = 'admin' LIMIT 1").first();if(existing)redirect("/login");
  const owner=await getChatGPTUser();
  if(!isOwnerIdentity(owner))return <main className="auth-page"><section className="auth-card"><img src="/logo-green.png" alt="Adsolution"/><h1>One-time Admin setup</h1><p>Verify the Site owner once, then create an independent CRM password. Clients and managers will use the CRM login, not ChatGPT.</p><a href={chatGPTSignInPath("/setup")}>Verify Site owner</a></section></main>;
  return <SetupForm email={owner!.email}/>;
}
