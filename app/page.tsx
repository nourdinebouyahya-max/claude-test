import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const u = await getCurrentUser();
  redirect(!u ? "/login" : u.role === "admin" ? "/admin" : "/manager");
}
