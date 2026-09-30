import { route } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { listAccounts, listActivity, listClients, listPayments, listTopups, type Filters } from "@/lib/queries";
import { dateTime } from "@/lib/format";
import { PLATFORM_LABEL, STATUS_LABEL, type Platform } from "@/lib/constants";

export const dynamic = "force-dynamic";

function csv(rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // spreadsheet formula injection guard
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

const hrs = (a: number | null, b: number | null) => (a && b ? ((b - a) / 3600_000).toFixed(2) : "");
const pl = (p: string | null) => (p ? PLATFORM_LABEL[p as Platform] ?? p : "");

export const GET = route(async (req, params) => {
  const user = await requireApiUser();
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries()) as Filters;
  let rows: (string | number | null)[][];
  switch (params.entity) {
    case "accounts":
      rows = [["ID", "Name", "Client", "Manager", "Platform", "Origin", "Ad account ID", "Price USD", "Fee %", "Status", "Reject reason", "Created", "First answer", "Decided", "Hours to first answer", "Hours to decide", "Created by", "Handled by"]];
      for (const r of listAccounts(user, sp))
        rows.push([r.id, r.name, r.client_name, r.manager_name, pl(r.platform), r.origin, r.ad_account_id, r.account_price, r.fee_pct, STATUS_LABEL[r.status], r.reject_reason,
          dateTime(r.created_at), dateTime(r.first_response_at), dateTime(r.decided_at), hrs(r.created_at, r.first_response_at), hrs(r.created_at, r.decided_at), r.created_by_name, r.handled_by_name]);
      break;
    case "topups":
      rows = [["ID", "Client", "Manager", "Ad account", "Platform", "Amount", "Currency", "USD", "Fee %", "Fee USD", "Net credited USD", "Method", "Reference", "Status", "Reject reason", "Created", "First answer", "Decided", "Created by", "Handled by"]];
      for (const r of listTopups(user, sp))
        rows.push([r.id, r.client_name, r.manager_name, r.account_name, pl(r.platform), r.amount, r.currency, r.usd_amount, r.fee_pct, r.fee_amount, r.net_amount, r.method_name, r.reference,
          STATUS_LABEL[r.status], r.reject_reason, dateTime(r.created_at), dateTime(r.first_response_at), dateTime(r.decided_at), r.created_by_name, r.handled_by_name]);
      break;
    case "payments":
      rows = [["ID", "Client", "Manager", "Purpose", "Account", "Amount", "Currency", "USD", "Method", "Reference", "Status", "Reject reason", "Created", "Decided", "Created by", "Handled by"]];
      for (const r of listPayments(user, sp))
        rows.push([r.id, r.client_name, r.manager_name, r.purpose === "account_order" ? "Account order" : "General", r.account_name, r.amount, r.currency, r.usd_amount, r.method_name,
          r.reference, STATUS_LABEL[r.status], r.reject_reason, dateTime(r.created_at), dateTime(r.decided_at), r.created_by_name, r.handled_by_name]);
      break;
    case "clients":
      rows = [["ID", "Business", "Contact", "Phone", "Email", "Markets", "Manager", "Status", "Needs review", "Accounts", "Active accounts", "Top-up volume USD", "Fees USD", "Created", "Created by"]];
      for (const r of listClients(user, sp))
        rows.push([r.id, r.business_name, r.contact_name, r.phone, r.email, r.markets, r.manager_name, r.status, r.needs_review ? "yes" : "no", r.accounts, r.active_accounts,
          r.volume, r.fees, dateTime(r.created_at), r.created_by_name]);
      break;
    case "activity": {
      if (user.role !== "admin") throw new ApiError(403, "Not allowed.");
      rows = [["Time", "User", "Role", "Action", "Entity", "Entity ID", "Client", "Before", "After", "Details"]];
      for (const r of listActivity({ manager: Number(sp.manager) || undefined, client: Number(sp.client) || undefined, from: sp.from, to: sp.to, limit: 20000 }))
        rows.push([dateTime(r.ts), r.user_name, r.role, r.action, r.entity_type, r.entity_id, r.client_name, r.before_status, r.after_status, r.details]);
      break;
    }
    default:
      throw new ApiError(404, "Unknown export.");
  }
  return new Response(csv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="adsolution-${params.entity}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
