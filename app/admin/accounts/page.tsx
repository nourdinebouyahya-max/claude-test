import { requirePageUser } from "@/lib/auth";
import { AccountsView } from "@/components/views/accounts";

export const metadata = { title: "Ad Accounts" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePageUser("admin");
  return <AccountsView user={user} base="/admin" sp={await searchParams} />;
}
