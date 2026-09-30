import { requirePageUser } from "@/lib/auth";
import { ClientsView } from "@/components/views/clients";

export const metadata = { title: "Clients" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePageUser("admin");
  return <ClientsView user={user} base="/admin" sp={await searchParams} />;
}
