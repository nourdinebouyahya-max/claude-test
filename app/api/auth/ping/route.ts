import { route, ok } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Polled by open dashboards so a disabled manager is signed out within seconds. */
export const GET = route(async () => {
  const u = await requireApiUser();
  return ok({ ok: true, role: u.role });
});
