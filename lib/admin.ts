import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getAuthUser } from "@/lib/crm-auth";

// Server-side allowlist for the Site owner. This value is not sent to the browser.
export const ADMIN_USER_ID = "b0aa3e25-9698-4d28-b18d-0b27a3cfb643";
// The Sites workspace account ID and the SIWC per-Site user ID are different.
// Match the verified SIWC email to the owner shown by the Site access policy.
const ADMIN_EMAIL = "nourdinebouyahya@gmail.com";

export function isOwnerIdentity(user: { userId: string; email: string } | null) {
  return !!user && (user.userId === ADMIN_USER_ID || user.email.trim().toLowerCase() === ADMIN_EMAIL);
}

export async function isAdmin() {
  return (await getAuthUser())?.role === "admin";
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !!origin && origin === new URL(request.url).origin;
}

export function privateJson(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}
