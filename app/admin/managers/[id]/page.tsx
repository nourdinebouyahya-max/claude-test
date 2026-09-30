import { requirePageUser } from "@/lib/auth";
import { parsePeriod } from "@/lib/period";
import { ManagerProfile } from "@/components/views/managers";

export const metadata = { title: "Manager" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  await requirePageUser("admin");
  const sp = await searchParams;
  return <ManagerProfile id={Number((await params).id)} p={parsePeriod(sp, "month")} sp={sp} />;
}
