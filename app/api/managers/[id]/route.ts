import { route, ok, readJson, str, email } from "@/lib/api";
import { ApiError, destroyUserSessions, hashPassword, requireApiUser, validatePassword } from "@/lib/auth";
import { db, tx } from "@/lib/db";
import { logAction } from "@/lib/activity";

type M = { id: number; name: string; email: string; phone: string | null; status: string; archived: number };

export const PATCH = route(async (req, params) => {
  const admin = await requireApiUser("admin");
  const id = Number(params.id);
  const m = db().prepare("SELECT id, name, email, phone, status, archived FROM users WHERE id = ? AND role = 'manager'").get(id) as M | undefined;
  if (!m) throw new ApiError(404, "Manager not found.");
  const b = await readJson(req);
  const action = str(b, "action", { required: "Action" });
  const log = (action: string, before: string | null, after: string | null, details?: string) =>
    logAction(admin, { action, entity_type: "manager", entity_id: id, manager_id: id, before, after, details });

  tx(() => {
    switch (action) {
      case "update": {
        const name = str(b, "name", { required: "Name", max: 120 });
        const mail = email(str(b, "email", { max: 200 }), "Email", true);
        const phone = str(b, "phone", { max: 40 });
        if (db().prepare("SELECT 1 FROM users WHERE email = ? AND id != ?").get(mail, id)) throw new ApiError(400, "Email already in use.");
        db().prepare("UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?").run(name, mail, phone || null, id);
        const changes = [m.name !== name && `name: ${m.name} → ${name}`, m.email !== mail && `email: ${m.email} → ${mail}`, (m.phone ?? "") !== phone && `phone: ${m.phone ?? "—"} → ${phone || "—"}`].filter(Boolean);
        log("updated", null, null, changes.join(" · ") || "No changes");
        break;
      }
      case "disable":
      case "enable": {
        const next = action === "disable" ? "disabled" : "active";
        if (m.archived) throw new ApiError(400, "Manager is archived.");
        db().prepare("UPDATE users SET status = ? WHERE id = ?").run(next, id);
        if (next === "disabled") destroyUserSessions(id); // logged out immediately
        log(action === "disable" ? "access_disabled" : "access_enabled", m.status, next);
        break;
      }
      case "reset_password": {
        const pw = validatePassword(b.password);
        db().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(pw), id);
        destroyUserSessions(id);
        log("password_reset", null, null, "Password reset by admin; all sessions signed out");
        break;
      }
      case "archive": {
        const clients = (db().prepare("SELECT COUNT(*) n FROM clients WHERE manager_id = ? AND status='active'").get(id) as { n: number }).n;
        if (clients > 0) throw new ApiError(400, `Reassign this manager's ${clients} active client(s) first.`);
        db().prepare("UPDATE users SET archived = 1, status = 'disabled' WHERE id = ?").run(id);
        destroyUserSessions(id);
        log("archived", m.status, "archived");
        break;
      }
      case "reassign_all": {
        const to = Number(b.to);
        const target = db().prepare("SELECT id, name FROM users WHERE id = ? AND role='manager' AND archived = 0").get(to) as { id: number; name: string } | undefined;
        if (!target || to === id) throw new ApiError(400, "Choose another manager.");
        const clients = db().prepare("SELECT id, business_name FROM clients WHERE manager_id = ?").all(id) as { id: number; business_name: string }[];
        for (const c of clients) {
          db().prepare("UPDATE clients SET manager_id = ? WHERE id = ?").run(to, c.id);
          logAction(admin, { action: "reassigned", entity_type: "client", entity_id: c.id, client_id: c.id, manager_id: to, before: m.name, after: target.name });
        }
        log("clients_reassigned", null, null, `${clients.length} client(s) moved to ${target.name}`);
        break;
      }
      default:
        throw new ApiError(400, "Unknown action.");
    }
  });
  return ok();
});
