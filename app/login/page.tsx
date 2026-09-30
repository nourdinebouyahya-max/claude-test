import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const u = await getCurrentUser();
  if (u) redirect(u.role === "admin" ? "/admin" : "/manager");
  const { reason } = await searchParams;
  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <img className="auth-logo" src="/logo-full.png" alt="Adsolution — Turn Clicks Into Profits" />
        <p className="muted small" style={{ textAlign: "center", margin: "4px 0 24px" }}>
          Agency ad accounts · Admin & Manager access
        </p>
        {reason === "signed-out" && (
          <div className="warn-box" style={{ marginBottom: 14 }}>
            Your session ended. If your access was turned off, contact the agency admin.
          </div>
        )}
        <LoginForm />
      </div>
    </div>
  );
}
