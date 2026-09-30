import { requirePageUser } from "@/lib/auth";
import { PaymentsView } from "@/components/views/payments";

export const metadata = { title: "Payments" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePageUser("manager");
  return <PaymentsView user={user} base="/manager" sp={await searchParams} />;
}
