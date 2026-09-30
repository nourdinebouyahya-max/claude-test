import Link from "next/link";
import type { Period } from "@/lib/period";
import { FilterForm } from "../client";

/** today / 7d / 30d / month / custom range selector (URL driven). */
export function PeriodPicker({ p, extra = {} }: { p: Period; extra?: Record<string, string | undefined> }) {
  const href = (k: string) => {
    const q = new URLSearchParams();
    for (const [a, b] of Object.entries(extra)) if (b) q.set(a, b);
    q.set("period", k);
    return `?${q}`;
  };
  return (
    <div className="row-wrap">
      <div className="seg">
        {[
          ["today", "Today"],
          ["7d", "7 days"],
          ["30d", "30 days"],
          ["month", "Month"],
        ].map(([k, l]) => (
          <Link key={k} href={href(k)} className={p.key === k ? "on" : ""} scroll={false}>
            {l}
          </Link>
        ))}
      </div>
      <FilterForm className="row">
        {Object.entries(extra).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
        <input type="hidden" name="period" value="custom" />
        <input className="input sm" type="date" name="from" defaultValue={p.fromStr} aria-label="From" style={{ width: 140 }} />
        <span className="muted">→</span>
        <input className="input sm" type="date" name="to" defaultValue={p.toStr} aria-label="To" style={{ width: 140 }} />
      </FilterForm>
    </div>
  );
}
