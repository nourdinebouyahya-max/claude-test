import { privateJson, sameOrigin } from "@/lib/admin";
import { portalContext, saveCrm, scopedClientIds, TASK_KINDS, TASK_STATUSES } from "@/lib/portal";

// A manager marks a client's request as Open / In progress / Done. The admin sees the same status on the Managers page.
export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return privateJson({ error: "Invalid request origin." }, 403);
  try {
    const { user, record, grant } = await portalContext();
    if (!user || !record || !grant || grant.role !== "manager" || !grant.permissions.includes("tasks")) return privateJson({ error: "Task updates are not available for this login." }, 403);
    let body: { kind?: string; id?: string; status?: string };
    try { body = JSON.parse(await request.text()); } catch { return privateJson({ error: "Invalid request." }, 400); }
    const collection = TASK_KINDS[body?.kind as keyof typeof TASK_KINDS];
    if (!collection || !(TASK_STATUSES as readonly string[]).includes(String(body.status))) return privateJson({ error: "Choose a valid request and status." }, 400);
    const state = record.state, item = state[collection].find(x => x.id === body.id);
    if (!item || !scopedClientIds(state, grant).has(item.clientId)) return privateJson({ error: "This request is not assigned to you." }, 403);
    const now = new Date().toISOString();
    item.managerStatus = body.status; item.managerUpdatedAt = now; item.managerUpdatedBy = grant.managerName || user.email;
    (state.activity ||= []).unshift({ text: `${grant.managerName || "Manager"} marked a ${body.kind} request ${String(body.status).toLowerCase()}`, kind: body.kind, recordId: item.id, clientId: item.clientId, createdAt: now });
    const saved = await saveCrm(record, now);
    return saved.ok ? privateJson({ ok: true }) : privateJson({ error: saved.error }, saved.status);
  } catch (error) {
    console.error("Portal task update failed", error);
    return privateJson({ error: "Could not update this request. Try again." }, 503);
  }
}
