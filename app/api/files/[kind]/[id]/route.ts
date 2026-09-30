import { route } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getClientFor } from "@/lib/access";
import { readProof } from "@/lib/files";

export const dynamic = "force-dynamic";

/** Streams a payment proof after checking the viewer may see that client. */
export const GET = route(async (req, params) => {
  const user = await requireApiUser();
  const table = params.kind === "topup" ? "topups" : params.kind === "payment" ? "payments" : null;
  if (!table) throw new ApiError(404, "Not found.");
  const row = db().prepare(`SELECT client_id, proof_path, proof_name, proof_mime FROM ${table} WHERE id = ?`).get(Number(params.id)) as
    | { client_id: number; proof_path: string | null; proof_name: string | null; proof_mime: string | null }
    | undefined;
  if (!row || !row.proof_path) throw new ApiError(404, "No proof uploaded.");
  getClientFor(user, row.client_id);
  const buf = readProof(row.proof_path);
  const download = req.nextUrl.searchParams.get("download") === "1";
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": row.proof_mime ?? "application/octet-stream",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${(row.proof_name ?? "proof").replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // PDFs need the browser viewer; images get a locked-down policy
      ...(row.proof_mime === "application/pdf" ? {} : { "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" }),
    },
  });
});
