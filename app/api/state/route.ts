import { env } from "cloudflare:workers";
import { isAdmin, privateJson, sameOrigin } from "@/lib/admin";
import { demoState } from "@/lib/demo-state";

export async function GET() {
  if (!(await isAdmin())) return privateJson({ error: "Admin sign-in required." }, 403);
  const db = env.DB;
  if (!db) return privateJson({ error: "CRM database is not configured." }, 503);
  try {
    let row = await db.prepare("SELECT revision, payload FROM crm_state WHERE user_id = ?")
      .bind("b0aa3e25-9698-4d28-b18d-0b27a3cfb643").first<{ revision: number; payload: string }>();
    if (!row) {
      // Seed only a truly new workspace; an existing record is never replaced.
      await db.prepare("INSERT OR IGNORE INTO crm_state (user_id, revision, payload, updated_at) VALUES (?, 1, ?, ?)")
        .bind("b0aa3e25-9698-4d28-b18d-0b27a3cfb643", JSON.stringify(demoState()), new Date().toISOString()).run();
      row = await db.prepare("SELECT revision, payload FROM crm_state WHERE user_id = ?")
        .bind("b0aa3e25-9698-4d28-b18d-0b27a3cfb643").first<{ revision: number; payload: string }>();
    }
    return privateJson({ revision: row?.revision ?? 0, state: row ? JSON.parse(row.payload) : null });
  } catch (error) {
    console.error("CRM state read failed", error);
    return privateJson({ error: "The CRM database is temporarily unavailable." }, 503);
  }
}

export async function PUT(request: Request) {
  if (!(await isAdmin())) return privateJson({ error: "Admin sign-in required." }, 403);
  const db = env.DB;
  if (!db) return privateJson({ error: "CRM database is not configured." }, 503);
  if (!sameOrigin(request)) return privateJson({ error: "Invalid request origin." }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return privateJson({ error: "Expected JSON." }, 415);
  const raw = await request.text();
  if (raw.length > 1_000_000) return privateJson({ error: "CRM records exceed the safe storage size." }, 413);
  let input: { revision?: number; state?: Record<string, unknown> };
  try { input = JSON.parse(raw); } catch { return privateJson({ error: "Invalid JSON." }, 400); }
  if (!Number.isSafeInteger(input.revision) || input.revision! < 0 || !input.state ||
      !["clients", "accounts", "payments", "topups", "activity"].every(k => Array.isArray(input.state?.[k])) ||
      (input.state.payments as Record<string, unknown>[]).some(p => typeof p.proofData === "string" && p.proofData.length > 0)) {
    return privateJson({ error: "Invalid CRM record data." }, 400);
  }
  try {
    const result = await db.prepare(`INSERT INTO crm_state (user_id, revision, payload, updated_at)
      VALUES (?, 1, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET revision = crm_state.revision + 1,
      payload = excluded.payload, updated_at = excluded.updated_at
      WHERE crm_state.revision = ?`)
      .bind("b0aa3e25-9698-4d28-b18d-0b27a3cfb643", JSON.stringify(input.state), new Date().toISOString(), input.revision).run();
    if (!result.meta.changes) return privateJson({ error: "Records changed in another tab. Reload to review them." }, 409);
    return privateJson({ revision: input.revision! + 1 });
  } catch (error) {
    console.error("CRM state write failed", error);
    return privateJson({ error: "Could not save CRM records. Please try again." }, 503);
  }
}
