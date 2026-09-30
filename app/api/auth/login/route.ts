import { NextResponse } from "next/server";
import { route, readJson, str, clientIp } from "@/lib/api";
import { ApiError, SESSION_COOKIE, createSession, loginBlocked, recordLogin, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction } from "@/lib/activity";

// Used to spend the same bcrypt time when the email does not exist.
const DUMMY_HASH = "$2b$12$5fD/oR6DQ7vXSxNPgxwpr.YhnGMeh.sG12MP5AsTeJ4xzelUvkF8C";

export const POST = route(async (req) => {
  const b = await readJson(req);
  const email = str(b, "email", { required: "Email", max: 200 }).toLowerCase();
  const password = str(b, "password", { required: "Password", max: 200 });
  const ip = clientIp(req);
  const wait = loginBlocked(email, ip);
  if (wait > 0) throw new ApiError(429, `Too many failed attempts. Try again in ${wait} min.`);

  const u = db()
    .prepare("SELECT id, name, role, password_hash, status, archived FROM users WHERE email = ?")
    .get(email) as { id: number; name: string; role: "admin" | "manager"; password_hash: string; status: string; archived: number } | undefined;
  const valid = verifyPassword(password, u?.password_hash ?? DUMMY_HASH) && !!u;
  if (!u || !valid) {
    recordLogin(email, ip, false);
    throw new ApiError(401, "Wrong email or password.");
  }
  if (u.status !== "active" || u.archived) {
    recordLogin(email, ip, false);
    throw new ApiError(403, "This account is disabled. Contact the agency admin.");
  }
  recordLogin(email, ip, true);
  const { token, maxAge } = createSession(u.id, ip, req.headers.get("user-agent"));
  logAction(u, { action: "signed_in", entity_type: "auth", entity_id: u.id, manager_id: u.role === "manager" ? u.id : null });

  const res = NextResponse.json({ ok: true, redirect: u.role === "admin" ? "/admin" : "/manager" });
  const secure = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge });
  return res;
});
