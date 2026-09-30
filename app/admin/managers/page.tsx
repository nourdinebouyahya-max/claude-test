import { requirePageUser } from "@/lib/auth";
import { parsePeriod } from "@/lib/period";
import { ManagersView } from "@/components/views/managers";

export const metadata = { title: "Managers" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requirePageUser("admin");
  return <ManagersView p={parsePeriod(await searchParams, "month")} />;
}
