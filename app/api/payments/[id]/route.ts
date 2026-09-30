import { route, ok, readJson, str } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { transition } from "@/lib/workflow";

export const PATCH = route(async (req, params) => {
  const user = await requireApiUser();
  const b = await readJson(req);
  const r = transition(user, "payment", Number(params.id), str(b, "action", { required: "Action" }), { reason: str(b, "reason", { max: 1000 }) });
  return ok({ ok: true, ...r });
});
