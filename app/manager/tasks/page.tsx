import { requirePageUser } from "@/lib/auth";
import { TasksView } from "@/components/views/tasks";
import { PageHead } from "@/components/ui";

export const metadata = { title: "Tasks" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePageUser("manager");
  return (
    <>
      <PageHead title="Tasks" sub="Everything open for your clients — account requests, top-ups and payments — in one queue." />
      <TasksView user={user} base="/manager" sp={await searchParams} />
    </>
  );
}
