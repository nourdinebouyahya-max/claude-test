import "server-only";
import { str, num, email, type Body } from "./api";
import { ApiError } from "./auth";
import { CURRENCIES, PLATFORM_LABEL, type Currency, type Platform } from "./constants";

export function clientFields(b: Body) {
  let website = str(b, "website", { max: 300 });
  if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;
  return {
    business_name: str(b, "business_name", { required: "Business name", max: 160 }),
    contact_name: str(b, "contact_name", { max: 120 }),
    phone: str(b, "phone", { max: 40 }),
    email: email(str(b, "email", { max: 200 })),
    website,
    markets: str(b, "markets", { max: 400 }),
    notes: str(b, "notes", { max: 3000 }),
  };
}

const isUrlish = (s: string) => /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(s);

export type PlatformDetails = Record<string, string | string[]>;

/** Validates the platform-specific block of an account request. Required fields are enforced here. */
export function platformDetails(p: Platform, raw: unknown): { origin: string | null; details: PlatformDetails } {
  const b = (raw && typeof raw === "object" ? raw : {}) as Body;
  const L = PLATFORM_LABEL[p];
  const req = (k: string, label: string, max = 300) => str(b, k, { required: `${L}: ${label}`, max });
  const opt = (k: string, max = 300) => str(b, k, { max });
  const origin = () => {
    const o = str(b, "origin", { required: `${L}: origin` });
    if (o !== "europe" && o !== "china") throw new ApiError(400, `${L}: choose Europe or China.`);
    return o;
  };
  const web = (v: string, label: string) => {
    if (v && !isUrlish(v)) throw new ApiError(400, `${L}: ${label} is not a valid link.`);
    return v;
  };
  switch (p) {
    case "meta": {
      const bm = req("bm_id", "Business Manager ID", 40);
      if (!/^\d{5,25}$/.test(bm)) throw new ApiError(400, "Meta: Business Manager ID must be digits only.");
      const pagesRaw = Array.isArray(b.pages) ? (b.pages as unknown[]).join("\n") : String(b.pages ?? "");
      const pages = pagesRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      if (!pages.length) throw new ApiError(400, "Meta: at least one Facebook Page link is required.");
      if (pages.length > 10) throw new ApiError(400, "Meta: maximum 10 Facebook Page links.");
      for (const pg of pages) if (!isUrlish(pg) || pg.length > 300) throw new ApiError(400, `Meta: "${pg.slice(0, 60)}" is not a valid page link.`);
      return { origin: origin(), details: { bm_id: bm, pages, website: web(opt("website"), "website") } };
    }
    case "google": {
      const ge = email(req("google_email", "Google account email", 200), "Google: account email", true);
      const website = web(req("website", "website"), "website");
      const mcc = opt("mcc_id", 20);
      if (mcc && !/^\d{3}-?\d{3}-?\d{4}$/.test(mcc)) throw new ApiError(400, "Google: MCC ID looks like 123-456-7890.");
      return { origin: origin(), details: { google_email: ge, website, mcc_id: mcc } };
    }
    case "tiktok": {
      const bc = req("bc_id", "Business Center ID", 40);
      if (!/^\d{5,25}$/.test(bc)) throw new ApiError(400, "TikTok: Business Center ID must be digits only.");
      const share = email(opt("share_email", 200), "TikTok: share email");
      const website = req("website", "website or TikTok profile");
      if (!isUrlish(website) && !/^@[\w.]{2,30}$/.test(website)) throw new ApiError(400, "TikTok: enter a website link or an @profile.");
      return { origin: null, details: { bc_id: bc, share_email: share, website } };
    }
    case "snapchat": {
      const org = req("org_id", "Organization / Business ID", 80);
      if (!/^[\w-]{4,80}$/.test(org)) throw new ApiError(400, "Snapchat: Organization ID contains invalid characters.");
      const se = email(opt("snap_email", 200), "Snapchat: email");
      return { origin: null, details: { org_id: org, snap_email: se, website: web(opt("website"), "website") } };
    }
  }
}

/** Amount + currency + USD equivalent (required when the currency is not USD/USDT). */
export function moneyInput(b: Body) {
  const amount = num(b, "amount", "Amount", { min: 0.01, max: 10_000_000, required: true });
  const currency = str(b, "currency", { required: "Currency" }) as Currency;
  if (!CURRENCIES.includes(currency)) throw new ApiError(400, "Unsupported currency.");
  let usd = amount;
  if (currency !== "USD" && currency !== "USDT") {
    usd = num(b, "usd_amount", "USD equivalent", { min: 0.01, max: 10_000_000, required: true });
  }
  return { amount, currency, usd: Math.round(usd * 100) / 100 };
}

export const METHOD_LOGOS = ["cih", "attijari", "bmce", "chaabi", "wise", "usdt", "payoneer", "wu", "redotpay", "cashplus", "kast", "bank"] as const;

export function methodFields(b: Body) {
  const logo = str(b, "logo") || "bank";
  return {
    name: str(b, "name", { required: "Name", max: 80 }),
    logo: (METHOD_LOGOS as readonly string[]).includes(logo) ? logo : "bank",
    holder: str(b, "holder", { required: "Account holder", max: 120 }),
    account: str(b, "account", { required: "IBAN / account / wallet", max: 200 }),
    currency: str(b, "currency", { max: 10 }) || null,
    instructions: str(b, "instructions", { max: 1000 }) || null,
    enabled: b.enabled === true || b.enabled === "1" || b.enabled === "on" || b.enabled === undefined,
  };
}
