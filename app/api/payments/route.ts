import { route, ok, str, formToBody } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { db, tx } from "@/lib/db";
import { logAction } from "@/lib/activity";
import { getClientFor } from "@/lib/access";
import { moneyInput } from "@/lib/validators";
import { saveProof } from "@/lib/files";

export const POST = route(async (req) => {
  const user = await requireApiUser();
  const fd = await req.formData().catch(() => {
    throw new ApiError(400, "Invalid form data.");
  });
  const b = formToBody(fd);
  const client = getClientFor(user, Number(b.client_id));
  const purpose = b.purpose === "account_order" ? "account_order" : "general";
  let accountId: number | null = null;
  if (purpose === "account_order") {
    const acc = db().prepare("SELECT id, client_id FROM accounts WHERE id = ?").get(Number(b.account_id)) as { id: number; client_id: number } | undefined;
    if (!acc || acc.client_id !== client.id) throw new ApiError(400, "Choose which account order this payment is for.");
    accountId = acc.id;
  }
  const method = db().prepare("SELECT id, name FROM receiving_methods WHERE id = ? AND archived = 0").get(Number(b.method_id)) as
    | { id: number; name: string }
    | undefined;
  if (!method) throw new ApiError(400, "Choose the payment method.");
  const m = moneyInput(b);
  const reference = str(b, "reference", { max: 120 });
  const notes = str(b, "notes", { max: 2000 });
  const proof = await saveProof(fd.get("proof"), true);
  const now = Date.now();
  const id = tx(() => {
    const id = Number(
      db()
        .prepare(
          `INSERT INTO payments (client_id, purpose, account_id, amount, currency, usd_amount, method_id, reference, proof_path, proof_name, proof_mime, status, notes,
            created_at, created_by, status_at) VALUES (?,?,?,?,?,?,?,?,?,?,?, 'pending', ?,?,?,?)`,
        )
        .run(client.id, purpose, accountId, m.amount, m.currency, m.usd, method.id, reference || null, proof!.path, proof!.name, proof!.mime, notes || null, now, user.id, now)
        .lastInsertRowid,
    );
    logAction(user, {
      action: "created",
      entity_type: "payment",
      entity_id: id,
      client_id: client.id,
      after: "pending",
      details: `${m.amount} ${m.currency} ($${m.usd}) via ${method.name} · ${purpose === "account_order" ? "account order" : "general"}`,
    });
    return id;
  });
  return ok({ ok: true, id });
});
