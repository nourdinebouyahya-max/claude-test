import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/crm-auth";
import PortalClient from "./portal-client";
import "./portal.css";
export async function RolePage({role,searchParams}:{role:"client"|"manager";searchParams:Promise<Record<string,string|undefined>>}){
  const user=await getAuthUser();if(!user)redirect(`/login?next=${encodeURIComponent(`/portal/${role}`)}`);
  const params=await searchParams;
  if(user.role==="admin"){
    if(params.previewRole||params.previewEmail){const query=new URLSearchParams();for(const key of ["previewRole","target","previewEmail"]){if(params[key])query.set(key,params[key]!)}return <PortalClient email={user.email} signOutHref="/access" previewQuery={query.toString()} adminPreview/>}
    redirect("/access");
  }
  if(user.role!==role)redirect(`/portal/${user.role}`);
  return <PortalClient email={user.email} signOutHref="/login"/>;
}
