import { env } from "cloudflare:workers";
import { isAdmin, privateJson, sameOrigin } from "@/lib/admin";

const allowed = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);

export async function POST(request: Request) {
  if (!(await isAdmin())) return privateJson({ error: "Admin sign-in required." }, 403);
  const bucket = env.BUCKET;
  if (!bucket) return privateJson({ error: "Proof storage is not configured." }, 503);
  if (!sameOrigin(request)) return privateJson({ error: "Invalid request origin." }, 403);
  try {
    const form = await request.formData();
    const file = form.get("proof");
    if (!(file instanceof File) || !allowed.has(file.type) || file.size > 1_500_000 || !file.size) {
      return privateJson({ error: "Use a PNG, JPG, WEBP or PDF under 1.5 MB." }, 400);
    }
    const key = crypto.randomUUID();
    const cleanName = file.name.replace(/[^\p{L}\p{N} ._-]/gu, "_").slice(0,120) || "proof";
    await bucket.put(`proofs/${key}`, file.stream(), {
      httpMetadata: { contentType: file.type }, customMetadata: { filename: cleanName },
    });
    return privateJson({ key }, 201);
  } catch (error) {
    console.error("Proof upload failed", error);
    return privateJson({ error: "Proof upload failed. Please try again." }, 503);
  }
}
