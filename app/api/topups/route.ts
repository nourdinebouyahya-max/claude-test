import { route, ok, str, formToBody } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { db, tx } from "@/lib/db";
import { logAction } from "@/lib/activity";
import { clientPricing, getClientFor } from "@/lib/access";
import { moneyInput } from "@/lib/validators";
import { saveProof } from "@/lib/files";
import { minTopup } from "@/lib/queries";
import { pricingKey, type Platform } from "@/lib/constants";

export const POST = route(async (req) => {
  const user = await requireApiUser();
  const fd = await req.formData().catch(() => {
    throw new ApiError(400, "Invalid form data.");
  });
  const b = formToBody(fd);
  const client = getClientFor(user, Number(b.client_id));
  if (client.status !== "active") throw new ApiError(400, "This client is archived.");
  const acc = db().prepare("SELECT id, client_id, platform, origin, status, name FROM accounts WHERE id = ?").get(Number(b.account_id)) as
    | { id: number; client_id: number; platform: Platform; origin: string | null; status: string; name: string }
    | undefined;
  if (!acc || acc.client_id !== client.id) throw new ApiError(400, "Choose one of this client's ad accounts.");
  if (acc.status !== "active") throw new ApiError(400, "Top-ups are only possible on ACTIVE ad accounts.");
  const method = db().prepare("SELECT id, name FROM receiving_methods WHERE id = ? AND enabled = 1 AND archived = 0").get(Number(b.method_id)) as
    | { id: number; name: string }
    | undefined;
  if (!method) throw new ApiError(400, "Choose the bank / wallet the client paid to.");
  const m = moneyInput(b);
  const min = minTopup();
  if (m.usd < min) throw new ApiError(400, `Minimum top-up is $${min} (USD equivalent).`);
  const reference = str(b, "reference", { max: 120 });
  const notes = str(b, "notes", { max: 2000 });
  const proof = await saveProof(fd.get("proof"), true);

  const fee = clientPricing(client.id)[pricingKey(acc.platform, acc.origin)].fee;
  const feeAmount = Math.round(m.usd * fee) / 100;
  const net = Math.round((m.usd - feeAmount) * 100) / 100;
  const now = Date.now();
  const id = tx(() => {
    const id = Number(
      db()
        .prepare(
          `INSERT INTO topups (client_id, account_id, amount, currency, usd_amount, method_id, reference, proof_path, proof_name, proof_mime, fee_pct, fee_amount, net_amount,
            status, notes, created_at, created_by, status_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, 'requested', ?,?,?,?)`,
        )
        .run(client.id, acc.id, m.amount, m.currency, m.usd, method.id, reference || null, proof!.path, proof!.name, proof!.mime, fee, feeAmount, net,
          notes || null, now, user.id, now).lastInsertRowid,
    );
    logAction(user, {
      action: "created",
      entity_type: "topup",
      entity_id: id,
      client_id: client.id,
      after: "requested",
      details: `${m.amount} ${m.currency} ($${m.usd}) via ${method.name} → ${acc.name} · fee ${fee}% = $${feeAmount} · net $${net}`,
    });
    return id;
  });
  return ok({ ok: true, id });
});
