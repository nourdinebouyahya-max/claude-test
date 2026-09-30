export const TIME_ZONE = "Africa/Casablanca";

export type Role = "admin" | "manager";

export const PLATFORMS = ["meta", "google", "tiktok", "snapchat"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABEL: Record<Platform, string> = {
  meta: "Meta",
  google: "Google Ads",
  tiktok: "TikTok",
  snapchat: "Snapchat",
};

export const ORIGINS = ["europe", "china"] as const;
export type Origin = (typeof ORIGINS)[number];
export const ORIGIN_LABEL: Record<Origin, string> = { europe: "Europe", china: "China" };

export function platformHasOrigin(p: Platform) {
  return p === "meta" || p === "google";
}

/** Pricing key: platform + origin for Meta/Google, platform alone otherwise. */
export const PRICING_KEYS = [
  "meta:europe",
  "meta:china",
  "google:europe",
  "google:china",
  "tiktok",
  "snapchat",
] as const;
export type PricingKey = (typeof PRICING_KEYS)[number];

export function pricingKey(platform: Platform, origin?: string | null): PricingKey {
  if (platformHasOrigin(platform)) return `${platform}:${origin === "china" ? "china" : "europe"}` as PricingKey;
  return platform as PricingKey;
}

export function pricingKeyLabel(k: string) {
  const [p, o] = k.split(":");
  return PLATFORM_LABEL[p as Platform] + (o ? ` · ${ORIGIN_LABEL[o as Origin]}` : "");
}

export const DEFAULT_PRICING: Record<PricingKey, { price: number; fee: number }> = {
  "meta:europe": { price: 89, fee: 6 },
  "meta:china": { price: 69, fee: 4 },
  "google:europe": { price: 69, fee: 8 },
  "google:china": { price: 49, fee: 6 },
  tiktok: { price: 39, fee: 3 },
  snapchat: { price: 49, fee: 5 },
};

export const CURRENCIES = ["USD", "MAD", "EUR", "GBP", "USDT"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const DEFAULT_FX: Record<Currency, number> = { USD: 1, MAD: 0.1, EUR: 1.08, GBP: 1.27, USDT: 1 };

export const MIN_TOPUP_USD = 100;
export const MAX_PROOF_BYTES = 1.5 * 1024 * 1024;

export const TIME_ZONES = [
  "Africa/Casablanca",
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Europe/Madrid",
  "Europe/Berlin",
  "Europe/Istanbul",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "America/New_York",
  "America/Los_Angeles",
];

/* ---------------- Statuses ---------------- */

export const ACCOUNT_STATUSES = [
  "requested",
  "in_progress",
  "delivered",
  "active",
  "rejected",
  "suspended",
  "replacement",
  "closed",
] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const TOPUP_STATUSES = ["requested", "payment_received", "processing", "completed", "rejected"] as const;
export type TopupStatus = (typeof TOPUP_STATUSES)[number];

export const PAYMENT_STATUSES = ["pending", "verified", "rejected"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  in_progress: "In progress",
  delivered: "Delivered",
  active: "Active",
  rejected: "Rejected",
  suspended: "Suspended",
  replacement: "Replacement",
  closed: "Closed",
  payment_received: "Payment received",
  processing: "Processing",
  completed: "Completed",
  pending: "Pending",
  verified: "Verified",
  archived: "Archived",
  disabled: "Disabled",
};

export type Tone = "green" | "amber" | "red" | "gray" | "blue";

export function statusTone(s: string): Tone {
  switch (s) {
    case "active":
    case "completed":
    case "verified":
    case "delivered":
      return "green";
    case "requested":
    case "pending":
    case "in_progress":
    case "payment_received":
    case "processing":
    case "replacement":
      return "amber";
    case "rejected":
    case "suspended":
    case "disabled":
      return "red";
    default:
      return "gray";
  }
}

/** Items whose status means "still needs someone to act". */
export const OPEN_ACCOUNT = ["requested", "in_progress", "delivered"];
export const OPEN_TOPUP = ["requested", "payment_received", "processing"];
export const OPEN_PAYMENT = ["pending"];

/** Terminal statuses that set decidedAt. */
export const DECIDED: Record<EntityKind, string[]> = {
  account: ["active", "rejected"],
  topup: ["completed", "rejected"],
  payment: ["verified", "rejected"],
};

export type EntityKind = "account" | "topup" | "payment";

/** Allowed forward transitions per entity. "reopen" is handled separately. */
export const TRANSITIONS: Record<EntityKind, Record<string, string[]>> = {
  account: {
    requested: ["in_progress", "rejected"],
    in_progress: ["delivered", "rejected"],
    delivered: ["active", "rejected"],
    active: ["suspended", "replacement", "closed"],
    suspended: ["active", "replacement", "closed"],
    replacement: ["active", "closed"],
    rejected: [],
    closed: [],
  },
  topup: {
    requested: ["payment_received", "rejected"],
    payment_received: ["processing", "rejected"],
    processing: ["completed", "rejected"],
    completed: [],
    rejected: [],
  },
  payment: {
    pending: ["verified", "rejected"],
    verified: [],
    rejected: [],
  },
};

/** Closed statuses that can be reopened, and where reopening sends them. */
export const REOPEN: Record<EntityKind, { from: string[]; to: string }> = {
  account: { from: ["rejected", "closed"], to: "in_progress" },
  topup: { from: ["completed", "rejected"], to: "requested" },
  payment: { from: ["verified", "rejected"], to: "pending" },
};

export const ACTION_LABEL: Record<string, string> = {
  in_progress: "Start",
  delivered: "Mark delivered",
  active: "Activate",
  rejected: "Reject",
  suspended: "Suspend",
  replacement: "Replacement",
  closed: "Close",
  payment_received: "Payment received",
  processing: "Processing",
  completed: "Complete",
  verified: "Verify",
  reopen: "Reopen",
};

export const EXPENSE_CATEGORIES = {
  account_purchase: "Account purchases (suppliers)",
  topup_supplier: "Top-up supplier costs",
  ads: "Ads / marketing",
  tools: "Tools & software",
  other: "Other",
} as const;
export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;

export const PAYMENT_PURPOSE = { account_order: "Account order", general: "General" } as const;
