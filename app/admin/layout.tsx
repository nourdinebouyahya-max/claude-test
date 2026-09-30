import Shell, { type NavItem } from "@/components/Shell";
import { requirePageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { reviewCount } from "@/lib/queries";
import { OPEN_ACCOUNT, OPEN_PAYMENT, OPEN_TOPUP } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser("admin");
  const q = (t: string, s: string[]) => (db().prepare(`SELECT COUNT(*) n FROM ${t} WHERE status IN (${s.map(() => "?").join(",")})`).get(...s) as { n: number }).n;
  const review = reviewCount();
  const nav: NavItem[] = [
    { href: "/admin", label: "Overview", icon: "overview" },
    { href: "/admin/managers", label: "Managers", icon: "managers" },
    { href: "/admin/clients", label: "Clients", icon: "clients", badge: review, warn: true },
    { href: "/admin/accounts", label: "Ad Accounts", icon: "accounts", badge: q("accounts", OPEN_ACCOUNT), section: "Operations" },
    { href: "/admin/topups", label: "Top-ups", icon: "topups", badge: q("topups", OPEN_TOPUP) },
    { href: "/admin/payments", label: "Payments", icon: "payments", badge: q("payments", OPEN_PAYMENT) },
    { href: "/admin/workflow", label: "Workflow", icon: "workflow" },
    { href: "/admin/finance", label: "Finance", icon: "finance", section: "Agency" },
    { href: "/admin/pricing", label: "Pricing", icon: "pricing" },
    { href: "/admin/banks", label: "Banks", icon: "banks" },
    { href: "/admin/activity", label: "Activity log", icon: "activity" },
    { href: "/admin/settings", label: "Settings", icon: "settings" },
  ];
  return (
    <Shell nav={nav} user={user} crumbsRoot="/admin" refreshMs={30000}>
      {children}
    </Shell>
  );
}
