import { TIME_ZONE } from "./constants";

export function usd(n: number | null | undefined, digits = 0) {
  const v = Number(n ?? 0);
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function usd2(n: number | null | undefined) {
  return usd(n, 2);
}

export function money(n: number, currency: string) {
  if (currency === "USDT") return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDT`;
  try {
    return n.toLocaleString("en-US", { style: "currency", currency, maximumFractionDigits: 2 });
  } catch {
    return `${n} ${currency}`;
  }
}

export function pct(n: number) {
  return `${Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}

export function compact(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(Math.round(n));
}

/** "2h 10m", "1d 4h", "35m", "<1m" */
export function duration(ms: number | null | undefined) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 60_000) return "<1m";
  const m = Math.floor(ms / 60_000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${mm}m`;
  return `${mm}m`;
}

const dtf = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const df = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, day: "2-digit", month: "short", year: "numeric" });

export function dateTime(ts: number | null | undefined) {
  return ts ? dtf.format(ts) : "—";
}

export function date(ts: number | null | undefined) {
  return ts ? df.format(ts) : "—";
}

export function ago(ts: number | null | undefined, now = Date.now()) {
  if (!ts) return "never";
  return `${duration(now - ts)} ago`;
}

/** YYYY-MM-DD for a timestamp in the agency time zone. */
export function ymd(ts: number) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(ts);
  return p; // en-CA gives YYYY-MM-DD
}
