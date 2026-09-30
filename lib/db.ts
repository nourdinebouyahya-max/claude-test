import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { ensureSeed } from "./seed";

export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(/* turbopackIgnore: true */ process.cwd(), "data"));
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin','manager')),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  is_sample INTEGER NOT NULL DEFAULT 0
);

-- Manager profile (one row per manager user)
CREATE TABLE IF NOT EXISTS managers (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,               -- sha256 of the cookie token
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  ip TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY,
  key TEXT NOT NULL,
  ts INTEGER NOT NULL,
  success INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_key ON login_attempts(key, ts);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY,
  business_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  markets TEXT,
  manager_id INTEGER REFERENCES users(id),
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_by_role TEXT,
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  needs_review INTEGER NOT NULL DEFAULT 0,
  reviewed_at INTEGER,
  reviewed_by INTEGER,
  is_sample INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_clients_manager ON clients(manager_id);

-- client_id = 0 holds the agency defaults
CREATE TABLE IF NOT EXISTS pricing (
  client_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  account_price REAL NOT NULL,
  fee_pct REAL NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by INTEGER,
  PRIMARY KEY (client_id, key)
);

CREATE TABLE IF NOT EXISTS receiving_methods (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  logo TEXT,
  holder TEXT,
  account TEXT,
  currency TEXT,
  instructions TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  is_sample INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY,
  group_id TEXT NOT NULL,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  platform TEXT NOT NULL,
  origin TEXT,
  name TEXT NOT NULL,
  ad_account_id TEXT,
  timezone TEXT,
  account_price REAL NOT NULL,
  fee_pct REAL NOT NULL,
  status TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '{}',
  notes TEXT,
  reject_reason TEXT,
  created_at INTEGER NOT NULL,
  created_by INTEGER REFERENCES users(id),
  handled_by INTEGER REFERENCES users(id),
  first_response_at INTEGER,
  decided_at INTEGER,
  status_at INTEGER NOT NULL,
  is_sample INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_accounts_client ON accounts(client_id);

CREATE TABLE IF NOT EXISTS topups (
  id INTEGER PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  usd_amount REAL NOT NULL,
  method_id INTEGER REFERENCES receiving_methods(id),
  reference TEXT,
  proof_path TEXT,
  proof_name TEXT,
  proof_mime TEXT,
  fee_pct REAL NOT NULL,
  fee_amount REAL NOT NULL,
  net_amount REAL NOT NULL,
  status TEXT NOT NULL,
  reject_reason TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  created_by INTEGER REFERENCES users(id),
  handled_by INTEGER REFERENCES users(id),
  first_response_at INTEGER,
  decided_at INTEGER,
  status_at INTEGER NOT NULL,
  is_sample INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_topups_client ON topups(client_id);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  purpose TEXT NOT NULL,
  account_id INTEGER REFERENCES accounts(id),
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  usd_amount REAL NOT NULL,
  method_id INTEGER REFERENCES receiving_methods(id),
  reference TEXT,
  proof_path TEXT,
  proof_name TEXT,
  proof_mime TEXT,
  status TEXT NOT NULL,
  reject_reason TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  created_by INTEGER REFERENCES users(id),
  handled_by INTEGER REFERENCES users(id),
  first_response_at INTEGER,
  decided_at INTEGER,
  status_at INTEGER NOT NULL,
  is_sample INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY,
  date INTEGER NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  amount_usd REAL NOT NULL,
  manager_id INTEGER REFERENCES users(id),
  created_by INTEGER REFERENCES users(id),
  created_at INTEGER NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  is_sample INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY,
  ts INTEGER NOT NULL,
  user_id INTEGER,
  user_name TEXT,
  role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  client_id INTEGER,
  manager_id INTEGER,
  before_status TEXT,
  after_status TEXT,
  details TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_log_ts ON activity_log(ts);
CREATE INDEX IF NOT EXISTS idx_log_user ON activity_log(user_id, ts);
CREATE INDEX IF NOT EXISTS idx_log_client ON activity_log(client_id, ts);
CREATE INDEX IF NOT EXISTS idx_log_entity ON activity_log(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

type G = typeof globalThis & { __adsDb?: Database.Database };

function open(): Database.Database {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const db = new Database(path.join(DATA_DIR, "adsolution.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(SCHEMA);
  ensureSeed(db);
  return db;
}

export function db(): Database.Database {
  const g = globalThis as G;
  if (!g.__adsDb) g.__adsDb = open();
  return g.__adsDb;
}

export function tx<T>(fn: () => T): T {
  return db().transaction(fn)();
}
