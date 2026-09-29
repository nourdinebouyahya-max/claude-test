import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/crm-auth";
import AccessClient from "./access-client";
import "./access.css";
export const dynamic="force-dynamic";
export default async function AccessPage(){
  const user=await getAuthUser();if(!user)redirect("/login?next=%2Faccess");
  if(user.role!=="admin")redirect(`/portal/${user.role}`);
  return <AccessClient/>;
}
