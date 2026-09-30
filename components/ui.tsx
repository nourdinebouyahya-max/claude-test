import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { PLATFORM_LABEL, ORIGIN_LABEL, STATUS_LABEL, statusTone, type Platform, type Origin } from "@/lib/constants";

export function PageHead({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="row-wrap">{children}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: "accent" | "warn" | "danger";
}) {
  return (
    <div className={`card stat ${tone ?? ""}`}>
      {icon && <div className="icon">{icon}</div>}
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  return <span className={`pill ${statusTone(status)}`}>{STATUS_LABEL[status] ?? status}</span>;
}

export function SampleTag({ show }: { show: number | boolean | null | undefined }) {
  return show ? <span className="tag sample" title="Demo data — removable from Settings">Sample</span> : null;
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <Inbox />
      <div>{children}</div>
    </div>
  );
}

export function Card({ title, sub, actions, children, pad = true }: { title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; pad?: boolean }) {
  return (
    <section className="card">
      {(title || actions) && (
        <div className="card-head">
          <div>
            {title && <h2>{title}</h2>}
            {sub && <p>{sub}</p>}
          </div>
          {actions && <div className="row-wrap">{actions}</div>}
        </div>
      )}
      {pad ? <div className="card-body">{children}</div> : children}
    </section>
  );
}

/* ---------------- Platform logos ---------------- */

export function PlatformIcon({ platform, size = 18 }: { platform: string; size?: number }) {
  const s = { width: size, height: size };
  switch (platform) {
    case "meta":
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden>
          <defs>
            <linearGradient id="metaG" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#0064E0" />
              <stop offset="1" stopColor="#0082FB" />
            </linearGradient>
          </defs>
          <path
            d="M2.5 14.6c0-4.3 2.2-8.1 5-8.1 2.1 0 3.6 1.9 5.3 4.8l1.6 2.7c1.3 2.2 2.3 3.4 3.4 3.4 1.2 0 1.9-1.1 1.9-3 0-3-1.4-5.8-3.2-5.8-1.3 0-2.4 1.4-3.6 3.4M12 11c-1.7 2.9-3.2 6-5.7 6-2.1 0-3.8-1-3.8-2.4"
            fill="none"
            stroke="url(#metaG)"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case "google":
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden>
          <path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" fill="#4285F4" />
          <path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" fill="#34A853" />
          <path d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.1L6.4 14z" fill="#FBBC05" />
          <path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6z" fill="#EA4335" />
        </svg>
      );
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden>
          <rect width="24" height="24" rx="6" fill="#111" />
          <g fill="none" strokeWidth="2.2" strokeLinecap="round">
            <path d="M13.4 5.2v9.3a2.9 2.9 0 1 1-2.9-2.9" stroke="#25F4EE" transform="translate(-.7 -.5)" />
            <path d="M13.4 5.2c.4 2 1.8 3.3 3.8 3.5" stroke="#25F4EE" transform="translate(-.7 -.5)" />
            <path d="M13.4 5.2v9.3a2.9 2.9 0 1 1-2.9-2.9" stroke="#FE2C55" transform="translate(.7 .5)" />
            <path d="M13.4 5.2c.4 2 1.8 3.3 3.8 3.5" stroke="#FE2C55" transform="translate(.7 .5)" />
            <path d="M13.4 5.2v9.3a2.9 2.9 0 1 1-2.9-2.9M13.4 5.2c.4 2 1.8 3.3 3.8 3.5" stroke="#fff" />
          </g>
        </svg>
      );
    case "snapchat":
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden>
          <rect width="24" height="24" rx="6" fill="#FFFC00" />
          <path
            d="M12 5.2c2.3 0 3.9 1.8 3.9 4v1.7l1.3-.4c.4 0 .6.4.3.7-.5.4-1.4.6-1.6.9-.1.3.9 2.2 2.6 2.6.3.1.3.5 0 .6-.6.3-1.4.3-1.6.6-.1.3 0 .8-.4.9-.5.1-1.2-.2-2 .2-.8.4-1.3 1.2-2.5 1.2s-1.7-.8-2.5-1.2c-.8-.4-1.5-.1-2-.2-.4-.1-.3-.6-.4-.9-.2-.3-1-.3-1.6-.6-.3-.1-.3-.5 0-.6 1.7-.4 2.7-2.3 2.6-2.6-.2-.3-1.1-.5-1.6-.9-.3-.3-.1-.7.3-.7l1.3.4V9.2c0-2.2 1.6-4 3.9-4z"
            fill="#fff"
            stroke="#111"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

export function PlatformName({ platform, origin, size }: { platform: string; origin?: string | null; size?: number }) {
  return (
    <span className="plat">
      <PlatformIcon platform={platform} size={size} />
      {PLATFORM_LABEL[platform as Platform] ?? platform}
      {origin && <span className="muted" style={{ fontWeight: 500 }}>· {ORIGIN_LABEL[origin as Origin] ?? origin}</span>}
    </span>
  );
}

/* ---------------- Bank / wallet logos ---------------- */

const BANK_STYLE: Record<string, { bg: string; fg?: string; text: string }> = {
  cih: { bg: "#E4570F", text: "CIH" },
  attijari: { bg: "#F4A300", fg: "#3a1f00", text: "AWB" },
  bmce: { bg: "#0B4EA2", text: "BOA" },
  chaabi: { bg: "#E0701F", text: "BP" },
  wise: { bg: "#9FE870", fg: "#163300", text: "WISE" },
  usdt: { bg: "#26A17B", text: "₮" },
  payoneer: { bg: "#FF4800", text: "P" },
  wu: { bg: "#FFDD00", fg: "#111", text: "WU" },
  redotpay: { bg: "#E0262E", text: "RP" },
  cashplus: { bg: "#0A9D58", text: "C+" },
  kast: { bg: "#111111", text: "K" },
  bank: { bg: "#078E82", text: "BANK" },
};

export function BankLogo({ logo, size = 28 }: { logo?: string | null; size?: number }) {
  const st = BANK_STYLE[logo ?? "bank"] ?? BANK_STYLE.bank;
  return (
    <span
      className="bank-logo"
      aria-hidden
      style={{ background: st.bg, color: st.fg ?? "#fff", width: size, height: size, fontSize: st.text.length > 3 ? size * 0.3 : size * 0.38 }}
    >
      {st.text}
    </span>
  );
}

export const BANK_LOGO_OPTIONS = [
  ["cih", "CIH Bank"],
  ["attijari", "Attijariwafa bank"],
  ["bmce", "Bank of Africa"],
  ["chaabi", "Banque Populaire / Chaabi"],
  ["wise", "Wise"],
  ["usdt", "USDT / Tether"],
  ["payoneer", "Payoneer"],
  ["wu", "Western Union"],
  ["redotpay", "RedotPay"],
  ["cashplus", "Cash Plus"],
  ["kast", "KAST"],
  ["bank", "Other bank"],
] as const;

export function Avatar({ name }: { name: string }) {
  const initials = name
    .replace(/^SAMPLE\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return <span className="avatar">{initials || "?"}</span>;
}

export function Waiting({ since, now = Date.now() }: { since: number; now?: number }) {
  const ms = now - since;
  const cls = ms > 24 * 3600_000 ? "red" : ms > 4 * 3600_000 ? "amber" : "gray";
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const label = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m % 60}m` : `${Math.max(m, 0)}m`;
  return <span className={`pill nodot ${cls}`}>{label}</span>;
}
