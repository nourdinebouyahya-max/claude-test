import "server-only";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import type { Role } from "./constants";

export const SESSION_COOKIE = "ads_session";
const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;

export type SessionUser = { id: number; role: Role; name: string; email: string };

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function hashPassword(pw: string) {
  return bcrypt.hashSync(pw, 12);
}

export function verifyPassword(pw: string, hash: string) {
  return bcrypt.compareSync(pw, hash);
}

export function validatePassword(pw: unknown): string {
  if (typeof pw !== "string" || pw.length < 8) throw new ApiError(400, "Password must be at least 8 characters.");
  if (pw.length > 200) throw new ApiError(400, "Password is too long.");
  return pw;
}

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export function createSession(userId: number, ip: string | null, ua: string | null) {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  db()
    .prepare("INSERT INTO sessions (id, user_id, created_at, expires_at, ip, user_agent) VALUES (?,?,?,?,?,?)")
    .run(sha(token), userId, now, now + SESSION_TTL_MS, ip, ua?.slice(0, 250) ?? null);
  return { token, maxAge: SESSION_TTL_MS / 1000 };
}

export function destroySession(token: string) {
  db().prepare("DELETE FROM sessions WHERE id = ?").run(sha(token));
}

/** Kills every session of a user — used when a manager is disabled or their password is reset. */
export function destroyUserSessions(userId: number) {
  db().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

function userFromToken(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const row = db()
    .prepare(
      `SELECT u.id, u.role, u.name, u.email FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > ? AND u.status = 'active' AND u.archived = 0`,
    )
    .get(sha(token), Date.now()) as SessionUser | undefined;
  return row ?? null;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return userFromToken(jar.get(SESSION_COOKIE)?.value);
}

/** For route handlers: throws 401/403. */
export async function requireApiUser(role?: Role): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) throw new ApiError(401, "Not signed in.");
  if (role && u.role !== role) throw new ApiError(403, "Not allowed.");
  return u;
}

/** For pages/layouts: redirects. */
export async function requirePageUser(role?: Role): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (role && u.role !== role) redirect(u.role === "admin" ? "/admin" : "/manager");
  return u;
}

/* ---------- Login rate limiting ---------- */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS_PER_KEY = 5;
const MAX_FAILS_PER_IP = 20;

export function loginBlocked(email: string, ip: string): number {
  const since = Date.now() - WINDOW_MS;
  const q = db().prepare("SELECT COUNT(*) c, MIN(ts) first FROM login_attempts WHERE key = ? AND ts > ? AND success = 0");
  const a = q.get(`e:${email.toLowerCase()}|${ip}`, since) as { c: number; first: number | null };
  const b = q.get(`ip:${ip}`, since) as { c: number; first: number | null };
  if (a.c >= MAX_FAILS_PER_KEY) return Math.ceil(((a.first ?? 0) + WINDOW_MS - Date.now()) / 60000);
  if (b.c >= MAX_FAILS_PER_IP) return Math.ceil(((b.first ?? 0) + WINDOW_MS - Date.now()) / 60000);
  return 0;
}

export function recordLogin(email: string, ip: string, success: boolean) {
  const now = Date.now();
  const ins = db().prepare("INSERT INTO login_attempts (key, ts, success) VALUES (?,?,?)");
  ins.run(`e:${email.toLowerCase()}|${ip}`, now, success ? 1 : 0);
  ins.run(`ip:${ip}`, now, success ? 1 : 0);
  if (success) db().prepare("DELETE FROM login_attempts WHERE key = ? AND success = 0").run(`e:${email.toLowerCase()}|${ip}`);
  db().prepare("DELETE FROM login_attempts WHERE ts < ?").run(now - 24 * 3600 * 1000);
}
