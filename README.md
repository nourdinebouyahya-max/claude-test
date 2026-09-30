# Adsolution — Agency Ad Accounts Management

Internal system for a media-buying agency that sells and funds Meta, Google Ads, TikTok and Snapchat ad accounts.
There are two dashboards, **Admin** and **Manager**. Clients never log in.

## Run it

```bash
npm install
cp .env.example .env        # optional: set ADMIN_EMAIL / ADMIN_PASSWORD before the first start
npm run build && npm start  # or: npm run dev
```

Open http://localhost:3000 and sign in.

| Who | Email | Password |
|---|---|---|
| Admin (first start) | `admin@adsolution.ma` (or `ADMIN_EMAIL`) | `Admin@2026!` (or `ADMIN_PASSWORD`). **Change it in Settings.** |
| SAMPLE manager | `yassine@sample.adsolution.ma` | `Sample@2026!` |
| SAMPLE manager | `salma@sample.adsolution.ma` | `Sample@2026!` |

The first start loads clearly marked **SAMPLE** data: 2 managers, 5 clients, ad accounts, top-ups, payments, expenses and demo bank details.
Remove it from **Admin → Settings → Remove samples**. Set `SEED_SAMPLES=false` to start empty.

The SQLite database and uploaded proofs are stored in `DATA_DIR` (default `./data`). Back up that folder.

## Stack

- Next.js 16 (App Router) + TypeScript, React 19
- SQLite via `better-sqlite3` with tables `users`, `managers`, `sessions`, `login_attempts`, `clients`, `pricing`, `accounts`,
  `topups`, `payments`, `receiving_methods`, `expenses`, `activity_log`, `settings`
- Proof files (PNG / JPG / WEBP / PDF, max 1.5 MB, checked by file content) are stored on disk and only served through an authenticated route

## Security

- Passwords are hashed with bcrypt. The admin can reset a password but never read one.
- Sessions use a random token in an HttpOnly, SameSite=Lax cookie; only its SHA-256 hash is stored.
- Disabling a manager, archiving them or resetting their password deletes all of their sessions. Open dashboards check the session every 15 s, so the manager is logged out almost immediately.
- Login is rate-limited: 5 failures per email+IP and 20 per IP within 15 minutes.
- Every API route checks permissions on the server (`lib/access.ts`). A manager gets a 404 for any client that is not assigned to them, including that client's accounts, top-ups, payments, proofs and CSV rows.
- Write requests from another origin are rejected.
- Nothing is hard-deleted: clients, managers, bank methods and expenses are archived. The one exception is the "Remove samples" button, which deletes only records flagged as SAMPLE.

## Tracking rules

Every account request, top-up and payment stores `created_at`, `first_response_at` (the first status change), `decided_at` (Active/Completed/Verified or Rejected), `created_by` and `handled_by`.
Status changes are only allowed along the defined workflow (`lib/constants.ts → TRANSITIONS`).
- A rejection requires a written reason.
- An ad account needs its ad account ID before it can be marked Delivered.
- Top-ups are only possible on ACTIVE ad accounts, with a minimum of $100 (configurable).
- Closed items can be reopened.

Every action is written to `activity_log` with who did it, their role, the time, the status before and after, and details.

Manager status badges: **Working** = an action in the last 24h · **Quiet** = 1–3 days · **Inactive** = more than 3 days · **Overdue** = an open item has been waiting more than 24h.

All dates use the Africa/Casablanca time zone. Money is shown as a USD equivalent; exchange rates in Settings only pre-fill it.
