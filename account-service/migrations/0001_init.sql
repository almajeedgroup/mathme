-- MathMe accounts, projects, billing and Campus licences.
-- Runs on Cloudflare D1 in production and on SQLite locally (same SQL).
-- Money is stored in paise (₹1 = 100 paise). Times are Unix seconds (UTC).

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_sub TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',          -- user | owner
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE INDEX users_email ON users (email);
CREATE INDEX users_created ON users (created_at);
CREATE INDEX users_seen ON users (last_seen_at);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions (user_id);

-- short-lived OAuth "state" values (protects the Google sign-in round trip)
CREATE TABLE oauth_states (
  state TEXT PRIMARY KEY,
  return_to TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  objects INTEGER NOT NULL DEFAULT 0,
  bytes INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  has_thumb INTEGER NOT NULL DEFAULT 0,
  shared_org_id TEXT,                          -- shared to a Campus class
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX projects_owner ON projects (owner_id, updated_at);
CREATE INDEX projects_shared ON projects (shared_org_id, updated_at);

CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  plan TEXT NOT NULL,                          -- plus | pro
  period TEXT NOT NULL,                        -- monthly | annual
  status TEXT NOT NULL,                        -- pending | active | past_due | cancelled | expired
  provider TEXT NOT NULL,                      -- cashfree | fake
  provider_ref TEXT,                           -- Cashfree subscription id or order id
  billing_name TEXT NOT NULL DEFAULT '',
  billing_state TEXT NOT NULL DEFAULT '',
  billing_gstin TEXT NOT NULL DEFAULT '',
  current_period_end INTEGER,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  reminders_sent TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX subscriptions_user ON subscriptions (user_id, status);
CREATE UNIQUE INDEX subscriptions_ref ON subscriptions (provider_ref);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  org_id TEXT,
  subscription_id TEXT,
  description TEXT NOT NULL,
  base INTEGER NOT NULL,
  cgst INTEGER NOT NULL DEFAULT 0,
  sgst INTEGER NOT NULL DEFAULT 0,
  igst INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  status TEXT NOT NULL,                        -- paid | failed | refunded
  provider TEXT NOT NULL,                      -- cashfree | fake | manual
  provider_ref TEXT,
  paid_at INTEGER NOT NULL
);
CREATE INDEX payments_paid ON payments (paid_at);
CREATE UNIQUE INDEX payments_ref ON payments (provider, provider_ref);

CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  number TEXT UNIQUE NOT NULL,                 -- MM/2026-27/000001
  payment_id TEXT NOT NULL REFERENCES payments (id),
  user_id TEXT,
  org_id TEXT,
  billing_name TEXT NOT NULL,
  billing_email TEXT NOT NULL,
  billing_state TEXT NOT NULL,
  billing_gstin TEXT NOT NULL DEFAULT '',
  lines TEXT NOT NULL,                         -- JSON
  issued_at INTEGER NOT NULL
);
CREATE INDEX invoices_user ON invoices (user_id, issued_at);

CREATE TABLE counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);

CREATE TABLE usage (
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,                          -- export | geometry | ai
  period TEXT NOT NULL,                        -- 2026-10 or 2026-10-09
  count INTEGER NOT NULL,
  PRIMARY KEY (user_id, kind, period)
);

CREATE TABLE webhook_events (
  id TEXT PRIMARY KEY,
  received_at INTEGER NOT NULL
);

CREATE TABLE enquiries (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,                          -- campus | enterprise
  institution TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  students INTEGER NOT NULL DEFAULT 0,
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',          -- new | contacted | converted | closed
  org_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,                        -- pilot | paid | expired
  student_seats INTEGER NOT NULL,
  teacher_seats INTEGER NOT NULL,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  billing_state TEXT NOT NULL DEFAULT '',
  billing_gstin TEXT NOT NULL DEFAULT '',
  billing_email TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE org_codes (
  code TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs (id) ON DELETE CASCADE,
  role TEXT NOT NULL                           -- teacher | student
);

CREATE TABLE org_members (
  org_id TEXT NOT NULL REFERENCES orgs (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role TEXT NOT NULL,                          -- teacher | student
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX org_members_user ON org_members (user_id);
