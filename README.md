# Adsolution CRM

Source code for the deployed Adsolution CRM. Built with Next.js/Vinext, Cloudflare Workers, D1, and R2.

## Workspaces

- `/` — Admin CRM for clients, ad accounts, top-ups, payments, finance, workflow and analytics.
- `/access` — Admin creates client and manager logins, resets their passwords, chooses allowed sections and explicitly assigns clients to each manager.
- `/portal/client` — A client sees only their own permitted records and can request ad accounts.
- `/portal/manager` — A manager sees only assigned clients and permitted records, can update assigned client contact details and request accounts for assigned clients.
- Portal submissions — clients and managers with the `requestTopups` / `submitPayments` permissions can request top-ups and send payment proofs (uploaded through `/api/portal/proofs`). Every portal submission is stamped `source: "portal"` with the submitter, appears in the admin **Portal Inbox** (with a live count badge) and follows the normal workflow. The admin CRM picks up portal changes every 30 seconds when idle.
- Admin **Managers** page — edit or remove managers, assign each client to a manager (kept in sync with the manager's portal grant), see every manager/client login status and preview any portal.
- `/login` — Email and password login for all roles. Admin accounts redirect to `/`, managers and clients to their workspaces.
- `/setup` — One-time Admin bootstrap. The verified Site owner signs in with ChatGPT once to create an independent CRM password. Subsequent CRM logins use the CRM email and password.

Passwords are salted, one-way hashed and stored in D1 `crm_users`. Sessions use an HttpOnly, Secure, SameSite cookie and D1 `crm_sessions`. Login attempts are rate limited with `crm_login_attempts`. Role permissions and manager client assignments are stored in the CRM state. Admin can reset a user password, but cannot view an existing password. Disabling a grant blocks portal data immediately, including an existing session.

CRM records are in D1 `crm_state`; payment proof files are in R2. The first Admin read seeds clearly marked fictional SAMPLE records only if the CRM state row is absent. Remove samples from `/access` before using live customer data. No invitation email is sent; share the login URL and initial credentials yourself through a secure channel.

## Development

Install with `pnpm install` (the repository includes `pnpm-lock.yaml`). Run `npm run build` to create the Worker build. `npm start` runs it with local Cloudflare bindings, which need D1 migration setup in your environment. Production publishing through Sites provisions D1/R2 and applies generated Drizzle migrations. After editing `db/schema.ts`, run `npm run db:generate` and keep every previously applied migration unchanged.

The `.openai/hosting.json` in this export identifies the existing deployed Site. If you create a *separate* deployment, configure a new project and its own D1/R2 bindings rather than reusing this project's production ID. The one-time owner bootstrap is tied to the verified owner email in `lib/admin.ts`; configure this for a different owner before deploying your own copy.
