import { env } from "cloudflare:workers";
import { isAdmin, privateJson } from "@/lib/admin";
import { portalContext, scopedClientIds } from "@/lib/portal";

export async function GET(request: Request, context: { params: Promise<{ key: string }> }) {
  const admin = await isAdmin();
  const bucket = env.BUCKET;
  if (!bucket) return privateJson({ error: "Proof storage is not configured." }, 503);
  const { key } = await context.params;
  if (!/^[0-9a-f-]{36}$/.test(key)) return privateJson({ error: "Invalid proof." }, 400);
  if (!admin) {
    const { record, grant } = await portalContext();
    const ids = record && grant?.permissions.includes("payments") ? scopedClientIds(record.state, grant) : null;
    if (!ids || !record!.state.payments.some(p => p.proofKey === key && ids.has(p.clientId))) {
      return privateJson({ error: "Proof unavailable." }, 403);
    }
  }
  try {
    const file = await bucket.get(`proofs/${key}`);
    if (!file) return privateJson({ error: "Proof unavailable." }, 404);
    const filename = (file.customMetadata?.filename || "proof").replace(/[\r\n"\\]/g, "_");
    const headers = new Headers({
      "Content-Type": file.httpMetadata?.contentType || "application/octet-stream",
      "Content-Disposition": `${new URL(request.url).searchParams.has("download") ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    });
    return new Response(file.body, { headers });
  } catch (error) {
    console.error("Proof retrieval failed", error);
    return privateJson({ error: "Proof is temporarily unavailable." }, 503);
  }
}
