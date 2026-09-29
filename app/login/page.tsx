import { redirect } from "next/navigation";
import { getAuthUser,safeNext } from "@/lib/crm-auth";
import AuthForm from "./auth-form";
import "./login.css";
export const dynamic="force-dynamic";
export default async function Login({searchParams}:{searchParams:Promise<{next?:string}>}){
  const next=(await searchParams).next;
  const user=await getAuthUser();if(user)redirect(safeNext(next,user.role));
  return <AuthForm next={next||""}/>;
}
