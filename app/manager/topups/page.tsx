import { requirePageUser } from "@/lib/auth";
import { TopupsView } from "@/components/views/topups";

export const metadata = { title: "Top-ups" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePageUser("manager");
  return <TopupsView user={user} base="/manager" sp={await searchParams} />;
}
