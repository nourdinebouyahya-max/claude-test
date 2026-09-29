import { env } from "cloudflare:workers";
import { privateJson, sameOrigin } from "@/lib/admin";
import { portalContext } from "@/lib/portal";

const allowed = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);

// Clients and managers upload payment proofs here; the returned key is attached by /api/portal/topups or /api/portal/payments.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return privateJson({ error: "Invalid request origin." }, 403);
  const { user, grant } = await portalContext();
  if (!user || !grant || !(grant.permissions.includes("requestTopups") || grant.permissions.includes("submitPayments"))) return privateJson({ error: "Proof upload is not available for this login." }, 403);
  const bucket = env.BUCKET;
  if (!bucket) return privateJson({ error: "Proof storage is not configured." }, 503);
  try {
    const file = (await request.formData()).get("proof");
    if (!(file instanceof File) || !allowed.has(file.type) || file.size > 1_500_000 || !file.size) return privateJson({ error: "Use a PNG, JPG, WEBP or PDF under 1.5 MB." }, 400);
    const key = crypto.randomUUID();
    const filename = file.name.replace(/[^\p{L}\p{N} ._-]/gu, "_").slice(0, 120) || "proof";
    await bucket.put(`proofs/${key}`, file.stream(), { httpMetadata: { contentType: file.type }, customMetadata: { filename } });
    return privateJson({ key, name: filename, type: file.type }, 201);
  } catch (error) {
    console.error("Portal proof upload failed", error);
    return privateJson({ error: "Proof upload failed. Please try again." }, 503);
  }
}
