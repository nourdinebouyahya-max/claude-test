import Link from "next/link";
import { Briefcase, Megaphone, Clock, Wallet, PiggyBank, AlertTriangle } from "lucide-react";
import { requirePageUser } from "@/lib/auth";
import { managerOverview } from "@/lib/metrics";
import { monthPeriod } from "@/lib/period";
import { listActivity, listTasks } from "@/lib/queries";
import { usd } from "@/lib/format";
import { Card, PageHead, Stat } from "@/components/ui";
import { TasksTable } from "@/components/views/tasks";
import { Timeline, formContext } from "@/components/views/common";
import { NewAccountButton, NewClientButton, NewTopupButton } from "@/components/buttons";

export const metadata = { title: "Overview" };

export default async function ManagerOverview() {
  const user = await requirePageUser("manager");
  const month = monthPeriod();
  const o = managerOverview(user.id, month);
  const open = listTasks(user, { view: "open" });
  const overdue = open.filter((t) => Date.now() - t.status_at > 24 * 3600_000).length;
  const ctx = formContext(user);
  return (
    <>
      <PageHead title={`Hello, ${user.name.replace(/^SAMPLE\s+/, "").split(" ")[0]}`} sub="Here is what needs your attention today.">
        <NewClientButton goTo="/manager/clients" />
        <NewAccountButton clients={ctx.clients} pricing={ctx.pricing} className="btn" />
        <NewTopupButton clients={ctx.clients} accounts={ctx.activeAccounts} methods={ctx.methods} pricing={ctx.pricing} fx={ctx.fx} min={ctx.min} className="btn" />
      </PageHead>
      {overdue > 0 && (
        <div className="banner" style={{ background: "var(--red-bg)", color: "var(--red-fg)", borderColor: "transparent" }}>
          <AlertTriangle size={18} /> {overdue} item{overdue > 1 ? "s have" : " has"} been waiting more than 24h. The admin sees these as overdue.
        </div>
      )}
      <div className="stats">
        <Stat label="My clients" value={o.clients} icon={<Briefcase />} />
        <Stat label="Active accounts" value={o.active_accounts} icon={<Megaphone />} />
        <Stat label="Open requests" value={o.open_requests} icon={<Clock />} tone={o.open_requests ? "warn" : undefined} />
        <Stat label="Top-ups this month" value={o.topups} sub={`${usd(o.volume)} volume`} icon={<Wallet />} />
        <Stat label="Fees earned (month)" value={usd(o.fees)} icon={<PiggyBank />} tone="accent" />
      </div>
      <div className="stack">
        <Card title={`Waiting on me (${open.length})`} sub="Oldest first" actions={<Link href="/manager/tasks" className="btn sm">Open tasks</Link>} pad={false}>
          <TasksTable rows={open.slice(0, 12)} base="/manager" view="open" />
        </Card>
        <Card title="My recent activity">
          <Timeline rows={listActivity({ user: user.id, limit: 12 })} showClient base="/manager" />
        </Card>
      </div>
    </>
  );
}
