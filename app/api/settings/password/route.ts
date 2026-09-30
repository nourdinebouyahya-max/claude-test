import { route, ok, readJson, str } from "@/lib/api";
import { ApiError, hashPassword, requireApiUser, validatePassword, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction } from "@/lib/activity";

/** Any signed-in user can change their own password. */
export const PUT = route(async (req) => {
  const user = await requireApiUser();
  const b = await readJson(req);
  const current = str(b, "current", { required: "Current password", max: 200 });
  const next = validatePassword(b.next);
  const row = db().prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id) as { password_hash: string };
  if (!verifyPassword(current, row.password_hash)) throw new ApiError(400, "Current password is wrong.");
  db().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(next), user.id);
  logAction(user, { action: "password_changed", entity_type: "auth", entity_id: user.id });
  return ok();
});
