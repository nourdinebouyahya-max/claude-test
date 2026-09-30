import type Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { DEFAULT_FX, DEFAULT_PRICING, PLATFORM_LABEL, PRICING_KEYS, pricingKey, type Platform } from "./constants";

/** Runs once per database: agency defaults, first admin, and (optionally) SAMPLE data. */
export function ensureSeed(db: Database.Database) {
  const done = db.prepare("SELECT value FROM settings WHERE key = 'seeded'").get();
  if (done) return;
  const now = Date.now();
  db.transaction(() => {
    const setS = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    setS.run("fx_rates", JSON.stringify(DEFAULT_FX));
    setS.run("min_topup_usd", "100");
    setS.run("agency_name", "Adsolution");

    const insP = db.prepare("INSERT OR IGNORE INTO pricing (client_id, key, account_price, fee_pct, updated_at) VALUES (0,?,?,?,?)");
    for (const k of PRICING_KEYS) insP.run(k, DEFAULT_PRICING[k].price, DEFAULT_PRICING[k].fee, now);

    const adminEmail = (process.env.ADMIN_EMAIL || "admin@adsolution.ma").toLowerCase();
    const adminPw = process.env.ADMIN_PASSWORD || "Admin@2026!";
    const hasAdmin = db.prepare("SELECT 1 FROM users WHERE role = 'admin'").get();
    if (!hasAdmin) {
      db.prepare("INSERT INTO users (role, name, email, password_hash, status, created_at) VALUES ('admin', 'Agency Admin', ?, ?, 'active', ?)").run(
        adminEmail,
        bcrypt.hashSync(adminPw, 12),
        now,
      );
      if (!process.env.ADMIN_PASSWORD)
        console.warn(`[adsolution] Created admin ${adminEmail} with the default password "${adminPw}". Change it in Settings.`);
    }

    if (process.env.SEED_SAMPLES !== "false") seedSamples(db, now);
    setS.run("seeded", String(now));
  })();
}

function seedSamples(db: Database.Database, now: number) {
  const H = 3600_000;
  const D = 24 * H;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const admin = db.prepare("SELECT id, name FROM users WHERE role='admin' ORDER BY id LIMIT 1").get() as { id: number; name: string };

  const pw = bcrypt.hashSync("Sample@2026!", 10);
  const insUser = db.prepare(
    "INSERT INTO users (role, name, email, phone, password_hash, status, created_at, is_sample) VALUES ('manager',?,?,?,?,'active',?,1)",
  );
  const mgrs = [
    { name: "SAMPLE Yassine El Amrani", email: "yassine@sample.adsolution.ma", phone: "+212 600 000 001" },
    { name: "SAMPLE Salma Bennani", email: "salma@sample.adsolution.ma", phone: "+212 600 000 002" },
  ].map((m) => {
    const id = Number(insUser.run(m.name, m.email, m.phone, pw, now - 40 * D).lastInsertRowid);
    db.prepare("INSERT INTO managers (user_id) VALUES (?)").run(id);
    return { id, name: m.name };
  });

  const insMethod = db.prepare(
    "INSERT INTO receiving_methods (name, logo, holder, account, currency, instructions, enabled, created_at, is_sample) VALUES (?,?,?,?,?,?,1,?,1)",
  );
  const methods = [
    ["CIH Bank", "cih", "ADSOLUTION SARL (SAMPLE)", "MA64 0000 0000 0000 0000 0000 001", "MAD", "Bank transfer. Put the client name as the reference. SAMPLE details — replace in Banks."],
    ["Attijariwafa bank", "attijari", "ADSOLUTION SARL (SAMPLE)", "MA64 0000 0000 0000 0000 0000 002", "MAD", "Transfer or deposit at any agency. SAMPLE details."],
    ["Wise", "wise", "Adsolution (SAMPLE)", "BE00 0000 0000 0000", "EUR", "Send in EUR or USD. SAMPLE details."],
    ["USDT TRC20", "usdt", "Adsolution wallet (SAMPLE)", "TSAMPLExxxxxxxxxxxxxxxxxxxxxxxxxxx", "USDT", "TRC20 network only. SAMPLE wallet — do not send."],
    ["Payoneer", "payoneer", "Adsolution (SAMPLE)", "payments@sample.adsolution.ma", "USD", "Request a payment to this email. SAMPLE details."],
    ["Cash Plus", "cashplus", "A. Admin (SAMPLE)", "CIN: XX000000", "MAD", "Send the receipt photo. SAMPLE details."],
  ].map((m) => ({ id: Number(insMethod.run(...m, now - 40 * D).lastInsertRowid), name: m[0] as string, currency: m[4] as string }));

  const insClient = db.prepare(
    `INSERT INTO clients (business_name, contact_name, phone, email, website, markets, manager_id, notes, created_by, created_by_role, created_at, status, needs_review, is_sample)
     VALUES (?,?,?,?,?,?,?,?,?,?,?, 'active', ?, 1)`,
  );
  const clientsDef = [
    ["SAMPLE Atlas Home Store", "Karim Tazi", "+212 611 111 111", "karim@atlas-sample.ma", "https://atlas-sample.ma", "Morocco, France", 0, 35, 0],
    ["SAMPLE Noor Cosmetics", "Nadia Alaoui", "+212 622 222 222", "nadia@noor-sample.com", "https://noor-sample.com", "Saudi Arabia, UAE", 0, 28, 0],
    ["SAMPLE Sahara Gadgets", "Omar Fassi", "+212 633 333 333", "omar@sahara-sample.shop", "https://sahara-sample.shop", "Spain, Italy, France", 1, 30, 0],
    ["SAMPLE Medina Fashion", "Hiba Idrissi", "+212 644 444 444", "hiba@medina-sample.ma", "https://medina-sample.ma", "Morocco", 1, 20, 0],
    ["SAMPLE Argan Pure", "Youssef Berrada", "+212 655 555 555", "y.berrada@argan-sample.com", "https://argan-sample.com", "USA, Canada", 0, 3, 1],
  ];
  const clients = clientsDef.map((c) => {
    const m = mgrs[c[6] as number];
    const created = now - (c[7] as number) * D;
    const id = Number(
      insClient.run(c[0], c[1], c[2], c[3], c[4], c[5], m.id, "Sample client for demo purposes.", m.id, "manager", created, c[8]).lastInsertRowid,
    );
    for (const k of PRICING_KEYS)
      db.prepare("INSERT INTO pricing (client_id, key, account_price, fee_pct, updated_at) VALUES (?,?,?,?,?)").run(
        id,
        k,
        DEFAULT_PRICING[k].price,
        // one client with a negotiated TikTok fee to show overrides
        k === "tiktok" && c[0] === "SAMPLE Noor Cosmetics" ? 2.5 : DEFAULT_PRICING[k].fee,
        created,
      );
    return { id, name: c[0] as string, mgr: m, created };
  });

  const log = db.prepare(
    `INSERT INTO activity_log (ts, user_id, user_name, role, action, entity_type, entity_id, client_id, manager_id, before_status, after_status, details, is_sample)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)`,
  );
  for (const c of clients) log.run(c.created, c.mgr.id, c.mgr.name, "manager", "created", "client", c.id, c.id, c.mgr.id, null, "active", c.name);

  const insAcc = db.prepare(
    `INSERT INTO accounts (group_id, client_id, platform, origin, name, ad_account_id, timezone, account_price, fee_pct, status, details, notes, reject_reason,
      created_at, created_by, handled_by, first_response_at, decided_at, status_at, is_sample)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
  );
  type Acc = { id: number; client: (typeof clients)[number]; platform: Platform; fee: number; price: number; status: string; created: number };
  const accounts: Acc[] = [];
  const accPlan: [number, Platform, string | null, string, number][] = [
    [0, "meta", "europe", "active", 33],
    [0, "google", "china", "active", 32],
    [0, "tiktok", null, "active", 20],
    [1, "meta", "china", "active", 27],
    [1, "tiktok", null, "active", 26],
    [1, "snapchat", null, "in_progress", 1.2],
    [2, "google", "europe", "active", 29],
    [2, "meta", "europe", "rejected", 15],
    [2, "meta", "europe", "delivered", 2],
    [3, "tiktok", null, "active", 18],
    [3, "snapchat", null, "active", 17],
    [4, "meta", "europe", "requested", 1.5],
  ];
  const counters: Record<string, number> = {};
  for (const [ci, platform, origin, status, daysAgo] of accPlan) {
    const c = clients[ci];
    const created = now - daysAgo * D;
    const pk = pricingKey(platform, origin);
    const { price, fee } = { price: DEFAULT_PRICING[pk].price, fee: platform === "tiktok" && ci === 1 ? 2.5 : DEFAULT_PRICING[pk].fee };
    const key = `${c.id}:${platform}`;
    counters[key] = (counters[key] ?? 0) + 1;
    const name = `${c.name} · ${PLATFORM_LABEL[platform]} ${String(counters[key]).padStart(2, "0")} · ${new Date(created).toISOString().slice(0, 10)}`;
    const first = status === "requested" ? null : created + (0.5 + rnd() * 5) * H;
    const decided = status === "active" || status === "rejected" ? created + (6 + rnd() * 30) * H : null;
    const details =
      platform === "meta"
        ? { bm_id: String(100000000000000 + Math.floor(rnd() * 1e12)), pages: [`https://facebook.com/${c.name.split(" ")[1].toLowerCase()}`], website: "" }
        : platform === "google"
          ? { google_email: `ads@${c.name.split(" ")[1].toLowerCase()}-sample.com`, website: "https://example.com" }
          : platform === "tiktok"
            ? { bc_id: String(7000000000000000000 + Math.floor(rnd() * 1e15)), share_email: "", website: "https://example.com" }
            : { org_id: crypto.randomUUID(), snap_email: "", website: "" };
    const adId = ["active", "delivered"].includes(status)
      ? platform === "google"
        ? `${100 + Math.floor(rnd() * 800)}-${100 + Math.floor(rnd() * 800)}-${1000 + Math.floor(rnd() * 8000)}`
        : String(Math.floor(1e14 + rnd() * 8e14))
      : null;
    const statusAt = decided ?? first ?? created;
    const id = Number(
      insAcc.run(
        crypto.randomUUID(), c.id, platform, origin, name, adId, "Africa/Casablanca", price, fee, status, JSON.stringify(details), null,
        status === "rejected" ? "Business Manager is restricted — client must appeal first." : null,
        created, c.mgr.id, first ? c.mgr.id : null, first, decided, statusAt,
      ).lastInsertRowid,
    );
    accounts.push({ id, client: c, platform, fee, price, status, created });
    log.run(created, c.mgr.id, c.mgr.name, "manager", "created", "account", id, c.id, c.mgr.id, null, "requested", name);
    if (first) log.run(first, c.mgr.id, c.mgr.name, "manager", "status_changed", "account", id, c.id, c.mgr.id, "requested", "in_progress", null);
    if (status === "active" || status === "delivered") {
      const t = (decided ?? now - H) - H;
      log.run(t, c.mgr.id, c.mgr.name, "manager", "status_changed", "account", id, c.id, c.mgr.id, "in_progress", "delivered", `Ad account ID: ${adId}`);
    }
    if (decided)
      log.run(decided, c.mgr.id, c.mgr.name, "manager", "status_changed", "account", id, c.id, c.mgr.id, status === "active" ? "delivered" : "in_progress", status,
        status === "rejected" ? "Reason: Business Manager is restricted — client must appeal first." : null);
  }

  const insTop = db.prepare(
    `INSERT INTO topups (client_id, account_id, amount, currency, usd_amount, method_id, reference, proof_path, proof_name, proof_mime, fee_pct, fee_amount, net_amount,
      status, reject_reason, created_at, created_by, handled_by, first_response_at, decided_at, status_at, is_sample)
     VALUES (?,?,?,?,?,?,?,NULL,NULL,NULL,?,?,?,?,?,?,?,?,?,?,?,1)`,
  );
  const active = accounts.filter((a) => a.status === "active");
  for (let i = 0; i < 38; i++) {
    const a = pick(active);
    const minCreated = a.created + 2 * D;
    const created = minCreated + rnd() * Math.max(0, now - minCreated - 2 * H);
    const m = pick(methods);
    const cur = m.currency === "MAD" ? "MAD" : m.currency === "EUR" ? "EUR" : m.currency === "USDT" ? "USDT" : "USD";
    const usdAmt = Math.round((150 + rnd() * 2400) / 10) * 10;
    const rate = cur === "MAD" ? 0.1 : cur === "EUR" ? 1.08 : 1;
    const amount = Math.round((usdAmt / rate) * 100) / 100;
    const age = now - created;
    let status = "completed";
    if (age < 6 * H) status = pick(["requested", "payment_received", "processing"]);
    else if (age < 30 * H) status = pick(["processing", "completed", "requested"]);
    else if (rnd() < 0.08) status = "rejected";
    const fee = Math.round(usdAmt * a.fee) / 100;
    const first = status === "requested" ? null : created + (0.2 + rnd() * 3) * H;
    const decided = status === "completed" || status === "rejected" ? (first ?? created) + (0.5 + rnd() * 8) * H : null;
    const reason = status === "rejected" ? "Amount on proof doesn't match the declared amount." : null;
    const id = Number(
      insTop.run(
        a.client.id, a.id, amount, cur, usdAmt, m.id, `SAMPLE-${1000 + i}`, a.fee, fee, usdAmt - fee, status, reason, created,
        a.client.mgr.id, first ? a.client.mgr.id : null, first, decided, decided ?? first ?? created,
      ).lastInsertRowid,
    );
    const mg = a.client.mgr;
    log.run(created, mg.id, mg.name, "manager", "created", "topup", id, a.client.id, mg.id, null, "requested", `$${usdAmt} via ${m.name}`);
    if (first) log.run(first, mg.id, mg.name, "manager", "status_changed", "topup", id, a.client.id, mg.id, "requested", "payment_received", null);
    if (decided) log.run(decided, mg.id, mg.name, "manager", "status_changed", "topup", id, a.client.id, mg.id, status === "completed" ? "processing" : "payment_received", status, reason ? `Reason: ${reason}` : null);
  }

  const insPay = db.prepare(
    `INSERT INTO payments (client_id, purpose, account_id, amount, currency, usd_amount, method_id, reference, status, reject_reason, created_at, created_by, handled_by,
      first_response_at, decided_at, status_at, is_sample) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
  );
  accounts.forEach((a, i) => {
    const m = methods[i % methods.length];
    const created = a.created + 0.3 * H;
    const status = now - created < 2 * D ? "pending" : "verified";
    const decided = status === "verified" ? created + 2 * H : null;
    const price = a.price;
    const id = Number(
      insPay.run(a.client.id, "account_order", a.id, price, "USD", price, m.id, `SAMPLE-PAY-${i}`, status, null, created, a.client.mgr.id,
        decided ? a.client.mgr.id : null, decided, decided, decided ?? created).lastInsertRowid,
    );
    log.run(created, a.client.mgr.id, a.client.mgr.name, "manager", "created", "payment", id, a.client.id, a.client.mgr.id, null, "pending", `$${price}`);
  });

  const insExp = db.prepare(
    "INSERT INTO expenses (date, category, description, amount_usd, manager_id, created_by, created_at, is_sample) VALUES (?,?,?,?,?,?,?,1)",
  );
  for (let i = 0; i < 6; i++) {
    const d = now - (3 + i * 5) * D;
    insExp.run(d, "account_purchase", "SAMPLE supplier account batch", 60 + Math.round(rnd() * 120), mgrs[i % 2].id, admin.id, d);
  }
  insExp.run(now - 12 * D, "ads", "SAMPLE Instagram promotion", 150, null, admin.id, now - 12 * D);
  insExp.run(now - 20 * D, "tools", "SAMPLE CRM + WhatsApp Business API", 49, null, admin.id, now - 20 * D);
}
