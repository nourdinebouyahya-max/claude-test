import Shell, { type NavItem } from "@/components/Shell";
import { requirePageUser } from "@/lib/auth";
import { listTasks } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser("manager");
  const open = listTasks(user, { view: "open" });
  const overdue = open.some((t) => Date.now() - t.status_at > 24 * 3600_000);
  const n = (k: string) => open.filter((t) => t.kind === k).length;
  const nav: NavItem[] = [
    { href: "/manager", label: "Overview", icon: "overview" },
    { href: "/manager/clients", label: "My Clients", icon: "clients" },
    { href: "/manager/accounts", label: "Ad Accounts", icon: "accounts", badge: n("account") },
    { href: "/manager/topups", label: "Top-ups", icon: "topups", badge: n("topup") },
    { href: "/manager/payments", label: "Payments", icon: "payments", badge: n("payment") },
    { href: "/manager/tasks", label: "Tasks", icon: "tasks", badge: open.length, warn: overdue },
  ];
  return (
    <Shell nav={nav} user={user} crumbsRoot="/manager" refreshMs={60000}>
      {children}
    </Shell>
  );
}
