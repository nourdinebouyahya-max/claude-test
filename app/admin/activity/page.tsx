import { Download } from "lucide-react";
import { requirePageUser } from "@/lib/auth";
import { clientOptions, listActivity, listManagerBasics } from "@/lib/queries";
import { Card, PageHead } from "@/components/ui";
import { Filters, Timeline, exportHref } from "@/components/views/common";

export const metadata = { title: "Activity log" };

export default async function Activity({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePageUser("admin");
  const sp = await searchParams;
  const rows = listActivity({ manager: Number(sp.manager) || undefined, client: Number(sp.client) || undefined, from: sp.from, to: sp.to, limit: 500 });
  return (
    <>
      <PageHead title="Activity log" sub="Every action in the system: who, what, when, before → after. Nothing is ever hard-deleted.">
        <a className="btn" href={exportHref("activity", sp)}>
          <Download /> CSV
        </a>
      </PageHead>
      <section className="card">
        <Filters sp={sp} base="/admin/activity" managers={listManagerBasics(true)} clients={clientOptions(user, false)} platform={false} search={false} />
        <div className="card-body">
          <Timeline rows={rows} showClient base="/admin" />
          {rows.length === 500 && <p className="small muted">Showing the latest 500 entries — narrow the filters or export CSV for more.</p>}
        </div>
      </section>
    </>
  );
}
