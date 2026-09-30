import { requirePageUser } from "@/lib/auth";
import { PaymentsView } from "@/components/views/payments";

export const metadata = { title: "Payments" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePageUser("admin");
  return <PaymentsView user={user} base="/admin" sp={await searchParams} />;
}
