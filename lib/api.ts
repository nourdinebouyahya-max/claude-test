import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "./auth";

type Ctx = { params: Promise<Record<string, string>> };

/** Wraps a route handler: same-origin check for writes + uniform JSON errors. */
export function route(fn: (req: NextRequest, params: Record<string, string>) => Promise<Response>) {
  return async (req: NextRequest, ctx: Ctx) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") checkOrigin(req);
      return await fn(req, (await ctx?.params) ?? {});
    } catch (e) {
      if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error(e);
      return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
    }
  };
}

function checkOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser client; the session cookie is SameSite=Lax anyway
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw new ApiError(403, "Cross-site request blocked.");
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(403, "Cross-site request blocked.");
  }
}

export const ok = (data: unknown = { ok: true }) => NextResponse.json(data);

export function clientIp(req: NextRequest) {
  return (req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local").slice(0, 64);
}

/* ---------- input helpers ---------- */
export type Body = Record<string, unknown>;

export async function readJson(req: NextRequest): Promise<Body> {
  try {
    const b = await req.json();
    if (!b || typeof b !== "object") throw new Error();
    return b as Body;
  } catch {
    throw new ApiError(400, "Invalid request body.");
  }
}

export function str(b: Body, key: string, opts: { required?: string; max?: number } = {}): string {
  const v = b[key];
  const s = v == null ? "" : String(v).trim();
  if (!s && opts.required) throw new ApiError(400, `${opts.required} is required.`);
  if (s.length > (opts.max ?? 2000)) throw new ApiError(400, `${opts.required ?? key} is too long.`);
  return s;
}

export function num(b: Body, key: string, label: string, opts: { min?: number; max?: number; required?: boolean } = {}): number {
  const raw = b[key];
  if ((raw === "" || raw == null) && !opts.required) return NaN;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n)) throw new ApiError(400, `${label} must be a number.`);
  if (opts.min != null && n < opts.min) throw new ApiError(400, `${label} must be at least ${opts.min}.`);
  if (opts.max != null && n > opts.max) throw new ApiError(400, `${label} must be at most ${opts.max}.`);
  return n;
}

export function oneOf<T extends string>(v: unknown, list: readonly T[], label: string): T {
  if (typeof v !== "string" || !list.includes(v as T)) throw new ApiError(400, `Invalid ${label}.`);
  return v as T;
}

export function email(v: string, label = "Email", required = false) {
  if (!v) {
    if (required) throw new ApiError(400, `${label} is required.`);
    return "";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new ApiError(400, `${label} is not a valid email.`);
  return v.toLowerCase();
}

export function formToBody(fd: FormData): Body {
  const b: Body = {};
  fd.forEach((v, k) => {
    if (typeof v === "string") b[k] = v;
  });
  return b;
}
