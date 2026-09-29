import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/crm-auth";
export const dynamic="force-dynamic";
export default async function Home(){
  const user=await getAuthUser();
  if(!user)redirect("/login?next=%2F");
  if(user.role!=="admin")redirect(`/portal/${user.role}`);
  return <main style={{position:"fixed",inset:0,background:"#f5f8f6"}}><iframe title="Adsolution CRM" src="/crm.html" style={{border:0,width:"100%",height:"100%"}} /></main>;
}
