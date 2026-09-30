import { route, ok, readJson, str, email } from "@/lib/api";
import { ApiError, hashPassword, requireApiUser, validatePassword } from "@/lib/auth";
import { db, tx } from "@/lib/db";
import { logAction } from "@/lib/activity";

export const POST = route(async (req) => {
  const admin = await requireApiUser("admin");
  const b = await readJson(req);
  const name = str(b, "name", { required: "Name", max: 120 });
  const mail = email(str(b, "email", { max: 200 }), "Email", true);
  const phone = str(b, "phone", { max: 40 });
  const pw = validatePassword(b.password);
  if (db().prepare("SELECT 1 FROM users WHERE email = ?").get(mail)) throw new ApiError(400, "A user with this email already exists.");
  const id = tx(() => {
    const id = Number(
      db()
        .prepare("INSERT INTO users (role, name, email, phone, password_hash, status, created_at) VALUES ('manager',?,?,?,?,'active',?)")
        .run(name, mail, phone || null, hashPassword(pw), Date.now()).lastInsertRowid,
    );
    db().prepare("INSERT INTO managers (user_id) VALUES (?)").run(id);
    logAction(admin, { action: "created", entity_type: "manager", entity_id: id, manager_id: id, after: "active", details: `${name} <${mail}>` });
    return id;
  });
  return ok({ ok: true, id });
});
