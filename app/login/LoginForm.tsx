"use client";

import { useState } from "react";

export default function LoginForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const fd = new FormData(e.currentTarget);
        try {
          const r = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") }),
          });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) setError(d.error ?? "Sign in failed.");
          else window.location.href = d.redirect;
        } catch {
          setError("Network error.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" className="input" name="email" type="email" autoComplete="username" required autoFocus />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" className="input" name="password" type="password" autoComplete="current-password" required />
      </div>
      {error && <div className="error-box">{error}</div>}
      <button className="btn primary" style={{ height: 42 }} disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
