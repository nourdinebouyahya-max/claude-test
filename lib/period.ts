import { TIME_ZONE } from "./constants";
import { ymd } from "./format";

export type PeriodKey = "today" | "7d" | "30d" | "month" | "custom";
export type Period = { key: PeriodKey; from: number; to: number; label: string; fromStr: string; toStr: string };

function offsetMs(ts: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(ts);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return asUtc - Math.floor(ts / 1000) * 1000;
}

/** Epoch ms of 00:00 in Africa/Casablanca on the given YYYY-MM-DD. */
export function tzMidnight(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let t = guess - offsetMs(guess);
  t = guess - offsetMs(t);
  return t;
}

export function addDays(dateStr: string, n: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export function parsePeriod(sp: { period?: string; from?: string; to?: string }, fallback: PeriodKey = "30d"): Period {
  const now = Date.now();
  const today = ymd(now);
  const key = (["today", "7d", "30d", "month", "custom"].includes(sp.period ?? "") ? sp.period : fallback) as PeriodKey;
  const end = tzMidnight(addDays(today, 1));
  switch (key) {
    case "today":
      return { key, from: tzMidnight(today), to: end, label: "Today", fromStr: today, toStr: today };
    case "7d":
      return { key, from: tzMidnight(addDays(today, -6)), to: end, label: "Last 7 days", fromStr: addDays(today, -6), toStr: today };
    case "month": {
      const first = today.slice(0, 8) + "01";
      return { key, from: tzMidnight(first), to: end, label: "This month", fromStr: first, toStr: today };
    }
    case "custom": {
      if (isDate(sp.from) && isDate(sp.to) && sp.from! <= sp.to!) {
        return {
          key,
          from: tzMidnight(sp.from!),
          to: tzMidnight(addDays(sp.to!, 1)),
          label: `${sp.from} → ${sp.to}`,
          fromStr: sp.from!,
          toStr: sp.to!,
        };
      }
      return parsePeriod({ period: "30d" });
    }
    default:
      return { key: "30d", from: tzMidnight(addDays(today, -29)), to: end, label: "Last 30 days", fromStr: addDays(today, -29), toStr: today };
  }
}

export function monthPeriod(): Period {
  return parsePeriod({ period: "month" });
}
