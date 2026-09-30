import fs from "node:fs";
import path from "node:path";
import { route, ok } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { db, tx, UPLOAD_DIR } from "@/lib/db";
import { logAction } from "@/lib/activity";

/**
 * Removes everything flagged as SAMPLE (demo managers, clients, their accounts/top-ups/payments,
 * demo bank details, expenses and log lines). Real records are never touched; references from real
 * records to sample users are simply cleared.
 */
export const DELETE = route(async () => {
  const admin = await requireApiUser("admin");
  const d = db();
  const counts = tx(() => {
    const sc = "SELECT id FROM clients WHERE is_sample = 1";
    const su = "SELECT id FROM users WHERE is_sample = 1";
    const sm = "SELECT id FROM receiving_methods WHERE is_sample = 1";
    const proofs = d.prepare(`SELECT proof_path FROM topups WHERE client_id IN (${sc}) AND proof_path IS NOT NULL UNION ALL SELECT proof_path FROM payments WHERE client_id IN (${sc}) AND proof_path IS NOT NULL`).all() as { proof_path: string }[];
    const c = {
      clients: (d.prepare("SELECT COUNT(*) n FROM clients WHERE is_sample = 1").get() as { n: number }).n,
      managers: (d.prepare("SELECT COUNT(*) n FROM users WHERE is_sample = 1").get() as { n: number }).n,
    };
    d.prepare(`DELETE FROM activity_log WHERE is_sample = 1 OR client_id IN (${sc}) OR user_id IN (${su})`).run();
    d.prepare(`DELETE FROM topups WHERE client_id IN (${sc}) OR is_sample = 1`).run();
    d.prepare(`DELETE FROM payments WHERE client_id IN (${sc}) OR is_sample = 1`).run();
    d.prepare(`UPDATE payments SET account_id = NULL WHERE account_id IN (SELECT id FROM accounts WHERE client_id IN (${sc}) OR is_sample = 1)`).run();
    d.prepare(`DELETE FROM accounts WHERE client_id IN (${sc}) OR is_sample = 1`).run();
    d.prepare(`DELETE FROM pricing WHERE client_id IN (${sc})`).run();
    d.prepare(`DELETE FROM clients WHERE is_sample = 1`).run();
    d.prepare(`DELETE FROM expenses WHERE is_sample = 1`).run();
    // detach real records from sample users / methods
    for (const [t, col] of [
      ["clients", "manager_id"], ["clients", "created_by"], ["clients", "reviewed_by"],
      ["accounts", "created_by"], ["accounts", "handled_by"], ["topups", "created_by"], ["topups", "handled_by"],
      ["payments", "created_by"], ["payments", "handled_by"], ["expenses", "manager_id"], ["expenses", "created_by"], ["pricing", "updated_by"],
    ])
      d.prepare(`UPDATE ${t} SET ${col} = NULL WHERE ${col} IN (${su})`).run();
    d.prepare(`UPDATE topups SET method_id = NULL WHERE method_id IN (${sm})`).run();
    d.prepare(`UPDATE payments SET method_id = NULL WHERE method_id IN (${sm})`).run();
    d.prepare(`DELETE FROM receiving_methods WHERE is_sample = 1`).run();
    d.prepare(`DELETE FROM sessions WHERE user_id IN (${su})`).run();
    d.prepare(`DELETE FROM managers WHERE user_id IN (${su})`).run();
    d.prepare(`DELETE FROM users WHERE is_sample = 1`).run();
    logAction(admin, { action: "samples_removed", entity_type: "system", details: `${c.managers} sample manager(s), ${c.clients} sample client(s) and their records removed` });
    return { ...c, proofs };
  });
  for (const p of counts.proofs) fs.rmSync(path.join(UPLOAD_DIR, path.basename(p.proof_path)), { force: true });
  return ok({ ok: true, clients: counts.clients, managers: counts.managers });
});
