import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { SESSION_COOKIE, destroySession } from "@/lib/auth";

export const POST = route(async (req) => {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) destroySession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
});
