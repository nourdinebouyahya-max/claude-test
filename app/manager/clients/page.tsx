import { requirePageUser } from "@/lib/auth";
import { ClientsView } from "@/components/views/clients";

export const metadata = { title: "My Clients" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePageUser("manager");
  return <ClientsView user={user} base="/manager" sp={await searchParams} />;
}
