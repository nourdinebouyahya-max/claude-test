import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/crm-auth";
export const dynamic="force-dynamic";
export default async function PortalPage(){const user=await getAuthUser();if(!user)redirect("/login");redirect(user.role==="admin"?"/":`/portal/${user.role}`)}
