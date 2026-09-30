import "server-only";
import { db, tx } from "./db";
import { ApiError, type SessionUser } from "./auth";
import { getClientFor } from "./access";
import { logAction } from "./activity";
import { DECIDED, REOPEN, STATUS_LABEL, TRANSITIONS, type EntityKind } from "./constants";

const TABLE: Record<EntityKind, string> = { account: "accounts", topup: "topups", payment: "payments" };

type Row = {
  id: number;
  client_id: number;
  status: string;
  first_response_at: number | null;
  decided_at: number | null;
  ad_account_id?: string | null;
};

export function loadItem(user: SessionUser, kind: EntityKind, id: number) {
  const row = db().prepare(`SELECT * FROM ${TABLE[kind]} WHERE id = ?`).get(id) as Row | undefined;
  if (!row) throw new ApiError(404, "Not found.");
  getClientFor(user, row.client_id); // ownership check
  return row;
}

/**
 * Applies a status change (or "reopen") with every rule from the spec:
 * allowed transitions only, written reason for rejections, ad account ID before delivery,
 * firstResponseAt / decidedAt / handledBy tracking, and an activity-log entry.
 */
export function transition(
  user: SessionUser,
  kind: EntityKind,
  id: number,
  action: string,
  opts: { reason?: string; ad_account_id?: string } = {},
) {
  return tx(() => {
    const row = loadItem(user, kind, id);
    const now = Date.now();
    let next: string;
    if (action === "reopen") {
      if (!REOPEN[kind].from.includes(row.status)) throw new ApiError(400, "Only closed items can be reopened.");
      next = REOPEN[kind].to;
    } else {
      if (!(TRANSITIONS[kind][row.status] ?? []).includes(action))
        throw new ApiError(400, `Cannot go from ${STATUS_LABEL[row.status]} to ${STATUS_LABEL[action] ?? action}.`);
      next = action;
    }

    const reason = (opts.reason ?? "").trim();
    if (next === "rejected" && reason.length < 3) throw new ApiError(400, "A written reason is required to reject.");
    if (reason.length > 1000) throw new ApiError(400, "Reason is too long.");

    const sets: string[] = ["status = ?", "status_at = ?", "handled_by = ?", "first_response_at = COALESCE(first_response_at, ?)"];
    const params: unknown[] = [next, now, user.id, now];

    let adId = "";
    if (kind === "account" && next === "delivered") {
      adId = (opts.ad_account_id?.trim() || row.ad_account_id || "").trim();
      if (!adId) throw new ApiError(400, "Enter the ad account ID before marking it delivered.");
      if (adId.length > 100) throw new ApiError(400, "Ad account ID is too long.");
      sets.push("ad_account_id = ?");
      params.push(adId);
    }

    if (action === "reopen") {
      sets.push("decided_at = NULL", "reject_reason = NULL");
    } else if (DECIDED[kind].includes(next)) {
      sets.push("decided_at = ?");
      params.push(now);
    }
    if (next === "rejected") {
      sets.push("reject_reason = ?");
      params.push(reason);
    }

    db().prepare(`UPDATE ${TABLE[kind]} SET ${sets.join(", ")} WHERE id = ?`).run(...params, id);

    const details: string[] = [];
    if (reason) details.push(`Reason: ${reason}`);
    if (kind === "account" && next === "delivered") details.push(`Ad account ID: ${adId}`);
    logAction(user, {
      action: action === "reopen" ? "reopened" : "status_changed",
      entity_type: kind,
      entity_id: id,
      client_id: row.client_id,
      before: row.status,
      after: next,
      details: details.join(" · ") || null,
    });
    return { status: next };
  });
}
