import { env } from "cloudflare:workers";
import { getAuthUser } from "@/lib/crm-auth";
import { grantFor, type CrmState } from "@/lib/portal-core";
export { MANAGER_SECTIONS, CLIENT_SECTIONS, TASK_STATUSES, TASK_KINDS, grantFor, scopedClientIds, portalProjection } from "@/lib/portal-core";
export type { Grant, Section, RecordValue, CrmState } from "@/lib/portal-core";

export async function readCrm(): Promise<{ revision: number; state: CrmState } | null> {
  if (!env.DB) throw new Error("CRM database is unavailable");
  const row = await env.DB.prepare("SELECT revision, payload FROM crm_state WHERE user_id = ?")
    .bind("b0aa3e25-9698-4d28-b18d-0b27a3cfb643")
    .first<{ revision: number; payload: string }>();
  return row ? { revision: row.revision, state: JSON.parse(row.payload) as CrmState } : null;
}

export async function portalContext() {
  const user = await getAuthUser();
  if (!user || user.role === "admin") return { user, record: null, grant: null };
  const record = await readCrm();
  const grant = record ? grantFor(record.state, user) : null;
  return { user, record, grant: grant?.role === user.role ? grant : null };
}

export const CRM_STATE_ID = "b0aa3e25-9698-4d28-b18d-0b27a3cfb643";
export const CURRENCIES = new Set(["USD", "MAD", "EUR", "GBP", "USDT"]);

/** Writes the CRM state with the same revision check the admin uses, so portal and admin edits never overwrite each other. */
export async function saveCrm(record: { revision: number; state: CrmState }, now: string): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (!env.DB) return { ok: false, error: "CRM database is unavailable.", status: 503 };
  const payload = JSON.stringify(record.state);
  if (payload.length > 1_000_000) return { ok: false, error: "CRM storage is full. Ask the admin to export and review old records.", status: 413 };
  const result = await env.DB.prepare("UPDATE crm_state SET payload = ?, revision = revision + 1, updated_at = ? WHERE user_id = ? AND revision = ?")
    .bind(payload, now, CRM_STATE_ID, record.revision).run();
  if (!result.meta.changes) return { ok: false, error: "Records changed while sending your request. Refresh and try again.", status: 409 };
  return { ok: true };
}

/** Confirms an uploaded proof exists before a record points at it. */
export async function proofExists(key: unknown): Promise<boolean> {
  if (typeof key !== "string" || !/^[0-9a-f-]{36}$/.test(key) || !env.BUCKET) return false;
  return !!(await env.BUCKET.head(`proofs/${key}`));
}
