import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const crmState = sqliteTable("crm_state", {
  userId: text("user_id").primaryKey(),
  revision: integer("revision").notNull().default(0),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const crmUsers = sqliteTable("crm_users", {
  email: text("email").primaryKey(),
  role: text("role").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const crmSessions = sqliteTable("crm_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  email: text("email").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const crmLoginAttempts = sqliteTable("crm_login_attempts", {
  key: text("key").primaryKey(),
  failures: integer("failures").notNull(),
  windowStart: text("window_start").notNull(),
  lockedUntil: text("locked_until"),
});
