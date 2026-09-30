"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, FileText, RotateCcw, Check, Ban, Play, Send, PackageCheck, Pause, Repeat, Archive } from "lucide-react";
import { ACTION_LABEL, REOPEN, TRANSITIONS, type EntityKind } from "@/lib/constants";

/* ---------------- API hook ---------------- */

export function useApi() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const call = useCallback(
    async <T = Record<string, unknown>,>(url: string, method: string, body?: unknown, opts: { refresh?: boolean } = {}): Promise<T | null> => {
      setBusy(true);
      setError(null);
      try {
        const isForm = typeof FormData !== "undefined" && body instanceof FormData;
        const res = await fetch(url, {
          method,
          headers: isForm || body === undefined ? undefined : { "Content-Type": "application/json" },
          body: isForm ? (body as FormData) : body === undefined ? undefined : JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          window.location.href = "/login?reason=signed-out";
          return null;
        }
        if (!res.ok) {
          setError(data.error ?? "Something went wrong.");
          return null;
        }
        if (opts.refresh !== false) router.refresh();
        return data as T;
      } catch {
        setError("Network error — please retry.");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [router],
  );
  return { call, busy, error, setError };
}

/* ---------------- Toast ---------------- */

export function toast(msg: string) {
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

/* ---------------- Modal ---------------- */

export function Modal({
  title,
  onClose,
  children,
  footer,
  size,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "lg";
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  if (!mounted) return null;
  return createPortal(
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size ?? ""}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn ghost icon" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Button that opens a modal hosting `render(close)`. */
export function ModalButton({
  label,
  icon,
  className = "btn primary",
  title,
  size,
  render,
}: {
  label: ReactNode;
  icon?: ReactNode;
  className?: string;
  title: ReactNode;
  size?: "lg";
  render: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {icon}
        {label}
      </button>
      {open && (
        <Modal title={title} onClose={close} size={size}>
          {render(close)}
        </Modal>
      )}
    </>
  );
}

/* ---------------- Workflow action buttons ---------------- */

const API: Record<EntityKind, string> = { account: "/api/accounts", topup: "/api/topups", payment: "/api/payments" };
const ICON: Record<string, ReactNode> = {
  in_progress: <Play />,
  delivered: <PackageCheck />,
  active: <Check />,
  rejected: <Ban />,
  suspended: <Pause />,
  replacement: <Repeat />,
  closed: <Archive />,
  payment_received: <Check />,
  processing: <Send />,
  completed: <Check />,
  verified: <Check />,
  reopen: <RotateCcw />,
};

export function ItemActions({
  kind,
  id,
  status,
  adAccountId,
  proofUrl,
  size = "xs",
}: {
  kind: EntityKind;
  id: number;
  status: string;
  adAccountId?: string | null;
  proofUrl?: string | null;
  size?: "xs" | "sm";
}) {
  const { call, busy, error, setError } = useApi();
  const [dialog, setDialog] = useState<null | "rejected" | "delivered" | "reopen" | "closed">(null);
  const [reason, setReason] = useState("");
  const [adId, setAdId] = useState(adAccountId ?? "");
  const [proofSeen, setProofSeen] = useState(false);

  const next = TRANSITIONS[kind][status] ?? [];
  const canReopen = REOPEN[kind].from.includes(status);

  const run = async (action: string, extra: Record<string, string> = {}) => {
    const r = await call(`${API[kind]}/${id}`, "PATCH", { action, ...extra });
    if (r) {
      setDialog(null);
      setReason("");
      toast(action === "reopen" ? "Reopened" : `Marked ${ACTION_LABEL[action]?.toLowerCase() ?? action}`);
    }
  };

  const click = (action: string) => {
    setError(null);
    if (action === "rejected" || action === "delivered" || action === "reopen" || action === "closed") setDialog(action);
    else run(action);
  };

  const needsProofCheck = kind === "topup" && status === "requested" && !!proofUrl && !proofSeen;
  const cls = `btn ${size}`;

  return (
    <div className="row-wrap" style={{ justifyContent: "flex-end", gap: 6 }}>
      {proofUrl && (
        <a className={cls} href={proofUrl} target="_blank" rel="noopener" onClick={() => setProofSeen(true)} title="Open payment proof">
          <FileText /> Proof
        </a>
      )}
      {next.map((a) => (
        <button
          key={a}
          className={`${cls} ${a === "rejected" ? "danger" : a === next[0] ? "primary" : ""}`}
          disabled={busy || (a === "payment_received" && needsProofCheck)}
          title={a === "payment_received" && needsProofCheck ? "Open the proof first" : undefined}
          onClick={() => click(a)}
        >
          {ICON[a]}
          {ACTION_LABEL[a] ?? a}
        </button>
      ))}
      {canReopen && (
        <button className={cls} disabled={busy} onClick={() => click("reopen")}>
          {ICON.reopen} Reopen
        </button>
      )}
      {error && !dialog && <span className="xs" style={{ color: "var(--red-fg)" }}>{error}</span>}
      {dialog && (
        <Modal
          title={dialog === "rejected" ? "Reject — reason required" : dialog === "delivered" ? "Mark as delivered" : dialog === "closed" ? "Close account" : "Reopen item"}
          onClose={() => setDialog(null)}
          footer={
            <>
              <button className="btn" onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button
                className={`btn ${dialog === "rejected" ? "solid-danger" : "primary"}`}
                disabled={busy || (dialog === "rejected" && reason.trim().length < 3) || (dialog === "delivered" && !adId.trim())}
                onClick={() => run(dialog, dialog === "delivered" ? { ad_account_id: adId } : { reason })}
              >
                {dialog === "rejected" ? "Reject" : dialog === "delivered" ? "Mark delivered" : dialog === "closed" ? "Close" : "Reopen"}
              </button>
            </>
          }
        >
          <div className="stack">
            {dialog === "rejected" && (
              <div className="field">
                <label>
                  Written reason<span className="req">*</span>
                </label>
                <textarea
                  className="input"
                  autoFocus
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={kind === "topup" ? "e.g. Amount on proof doesn't match" : "Explain why this is rejected"}
                  maxLength={1000}
                />
                <span className="hint">Shown in the history and to the admin.</span>
              </div>
            )}
            {dialog === "delivered" && (
              <div className="field">
                <label>
                  Ad account ID<span className="req">*</span>
                </label>
                <input className="input mono" autoFocus value={adId} onChange={(e) => setAdId(e.target.value)} placeholder="e.g. 1234567890123456 or 123-456-7890" maxLength={100} />
              </div>
            )}
            {(dialog === "reopen" || dialog === "closed") && (
              <div className="field">
                <label>Note (optional)</label>
                <textarea className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
                <span className="hint">{dialog === "reopen" ? "Reopening is recorded in the activity log." : "The account will be closed. It can be reopened later."}</span>
              </div>
            )}
            {error && <div className="error-box">{error}</div>}
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Auto-submitting filter form ---------------- */

export function FilterForm({ children, className = "filters" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const submit = () => {
    const f = ref.current;
    if (!f) return;
    const params = new URLSearchParams();
    new FormData(f).forEach((v, k) => {
      if (typeof v === "string" && v !== "") params.set(k, v);
    });
    router.replace(`?${params.toString()}`, { scroll: false });
  };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onChange={(e) => {
        const t = e.target as unknown as HTMLInputElement;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(submit, t.type === "search" || t.type === "text" ? 400 : 0);
      }}
    >
      {children}
    </form>
  );
}

/* ---------------- Simple confirm-and-call button ---------------- */

export function CallButton({
  url,
  method = "PATCH",
  body,
  label,
  icon,
  className = "btn sm",
  confirm,
  done,
}: {
  url: string;
  method?: string;
  body?: unknown;
  label: ReactNode;
  icon?: ReactNode;
  className?: string;
  confirm?: string;
  done?: string;
}) {
  const { call, busy, error } = useApi();
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={busy}
        onClick={async () => {
          if (confirm && !window.confirm(confirm)) return;
          const r = await call(url, method, body);
          if (r && done) toast(done);
        }}
      >
        {icon}
        {label}
      </button>
      {error && <span className="xs" style={{ color: "var(--red-fg)" }}>{error}</span>}
    </>
  );
}

export function Toggle({ on, url, body, label }: { on: boolean; url: string; body: unknown; label: string }) {
  const { call, busy, error } = useApi();
  return (
    <span className="row">
      <button type="button" className={`toggle ${on ? "on" : ""}`} disabled={busy} aria-pressed={on} aria-label={label} title={label} onClick={() => call(url, "PATCH", body)} />
      {error && <span className="xs" style={{ color: "var(--red-fg)" }}>{error}</span>}
    </span>
  );
}
