import { requirePageUser } from "@/lib/auth";
import { ClientProfile } from "@/components/views/clients";

export const metadata = { title: "Client" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePageUser("admin");
  return <ClientProfile user={user} base="/admin" id={Number((await params).id)} tab={(await searchParams).tab} />;
}
