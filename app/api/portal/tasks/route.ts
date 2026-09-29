import { privateJson, sameOrigin } from "@/lib/admin";
import { applyTaskAction, portalContext, saveCrm } from "@/lib/portal";

// A manager works a client's request: verify the payment proof, process, complete or reject (with a reason).
// The admin sees every action, who did it and how long it took.
export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return privateJson({ error: "Invalid request origin." }, 403);
  try {
    const { user, record, grant } = await portalContext();
    if (!user || !record || !grant || grant.role !== "manager" || !grant.permissions.includes("tasks")) return privateJson({ error: "Task updates are not available for this login." }, 403);
    let body: { kind?: string; id?: string; action?: string; note?: string };
    try { body = JSON.parse(await request.text()); } catch { return privateJson({ error: "Invalid request." }, 400); }
    const now = new Date().toISOString();
    const problem = applyTaskAction(record.state, grant, body || {}, now);
    if (problem) return privateJson({ error: problem }, problem.startsWith("This request") ? 403 : 400);
    const saved = await saveCrm(record, now);
    return saved.ok ? privateJson({ ok: true }) : privateJson({ error: saved.error }, saved.status);
  } catch (error) {
    console.error("Portal task update failed", error);
    return privateJson({ error: "Could not update this request. Try again." }, 503);
  }
}
