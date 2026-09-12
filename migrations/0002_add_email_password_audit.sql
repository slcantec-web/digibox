-- ============================================================
-- CloudBase Digital Feedback Box - Cloudflare D1 Migration 0002
-- File: migrations/0002_add_email_password_audit.sql
-- Description: Adds missing columns for automated report email,
--              custom messages, and new tables for password reset
--              tracking and administrative audit logs.
-- ============================================================

-- 1. Add automated email & custom messages to organizations table
ALTER TABLE organizations ADD COLUMN contact_email TEXT DEFAULT 'management@cantec.lk';
ALTER TABLE organizations ADD COLUMN welcome_message TEXT DEFAULT 'Welcome to our Digital Feedback Box. Your voice helps us improve everyday.';
ALTER TABLE organizations ADD COLUMN thank_you_message TEXT DEFAULT 'Thank you for your valuable feedback! Our management team reviews all submissions promptly.';

-- 2. Add recipient email to daily_reports table
ALTER TABLE daily_reports ADD COLUMN recipient_email TEXT;

-- 3. Password Reset Logs (Captures all operator password resets and credential changes)
CREATE TABLE IF NOT EXISTS password_reset_logs (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  username TEXT NOT NULL,
  reset_by TEXT NOT NULL, -- 'self' | 'admin' | 'org_code'
  ip_address TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pw_resets_op ON password_reset_logs(operator_id);
CREATE INDEX IF NOT EXISTS idx_pw_resets_date ON password_reset_logs(created_at);

-- 4. Audit Logs (Captures automated report email changes, settings updates, and admin operations)
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  actor_id TEXT,
  actor_username TEXT,
  action TEXT NOT NULL, -- 'automated_email_updated', 'password_changed', 'password_reset', 'organization_updated', 'user_created', etc.
  details TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(created_at);

-- 5. Backfill existing organization rows if null
UPDATE organizations 
SET contact_email = 'management@cantec.lk'
WHERE contact_email IS NULL;

UPDATE organizations 
SET welcome_message = 'Welcome to our Digital Feedback Box. Your voice helps us improve everyday.'
WHERE welcome_message IS NULL;

UPDATE organizations 
SET thank_you_message = 'Thank you for your valuable feedback! Our management team reviews all submissions promptly.'
WHERE thank_you_message IS NULL;
