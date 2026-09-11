-- ============================================================
-- CloudBase Digital Feedback Box - Cloudflare D1 Migration
-- File: migrations/0001_initial_schema.sql
-- ============================================================

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Feedback Boxes
CREATE TABLE IF NOT EXISTS feedback_boxes (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  box_code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  public_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_boxes_org ON feedback_boxes(organization_id);
CREATE INDEX IF NOT EXISTS idx_boxes_code ON feedback_boxes(box_code);

-- 3. Operators
CREATE TABLE IF NOT EXISTS operators (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator', -- 'admin' or 'operator'
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_operators_org ON operators(organization_id);

-- 4. Feedback Groups (Aggregation for head count)
CREATE TABLE IF NOT EXISTS feedback_groups (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  feedback_box_id TEXT,
  type TEXT NOT NULL, -- 'suggestion' or 'complaint'
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (feedback_box_id) REFERENCES feedback_boxes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_groups_org ON feedback_groups(organization_id);

-- 5. Submissions
-- Note: NO UNIQUE CONSTRAINT ON message or message_hash (Duplicates are welcomed and preserved)
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  feedback_box_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'suggestion' or 'complaint'
  message TEXT NOT NULL,
  submitter_name TEXT,
  submitter_contact TEXT,
  is_anonymous INTEGER NOT NULL DEFAULT 1,
  device_token_hash TEXT NOT NULL,
  security_hash TEXT,
  message_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'New',
  group_id TEXT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (feedback_box_id) REFERENCES feedback_boxes(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES feedback_groups(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_subs_org ON submissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subs_type ON submissions(type);
CREATE INDEX IF NOT EXISTS idx_subs_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_subs_box ON submissions(feedback_box_id);
CREATE INDEX IF NOT EXISTS idx_subs_group ON submissions(group_id);
CREATE INDEX IF NOT EXISTS idx_subs_msg_hash ON submissions(message_hash);
CREATE INDEX IF NOT EXISTS idx_subs_device ON submissions(device_token_hash);
CREATE INDEX IF NOT EXISTS idx_subs_date ON submissions(submitted_at);

-- 6. Submission Group Members (association table)
CREATE TABLE IF NOT EXISTS submission_group_members (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES feedback_groups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sgm_sub ON submission_group_members(submission_id);
CREATE INDEX IF NOT EXISTS idx_sgm_group ON submission_group_members(group_id);

-- 7. Feedback Notes (Internal operator notes, confidential)
CREATE TABLE IF NOT EXISTS feedback_notes (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notes_sub ON feedback_notes(submission_id);

-- 8. Sessions (Operator authentication)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  session_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_op ON sessions(operator_id);

-- 9. Daily Reports (For cron trigger, email delivery & duplicate prevention)
CREATE TABLE IF NOT EXISTS daily_reports (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  report_date TEXT NOT NULL,
  status TEXT NOT NULL, -- 'sent', 'failed', 'generated'
  sent_at TEXT,
  error_message TEXT,
  report_payload TEXT NOT NULL, -- JSON string
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT uq_org_date UNIQUE (organization_id, report_date),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reports_org_date ON daily_reports(organization_id, report_date);

-- ============================================================
-- INITIAL SEED DATA
-- ============================================================

-- Insert Organization
INSERT OR IGNORE INTO organizations (id, name, code, status)
VALUES ('org-cantec-001', 'Cantec Printing & Packaging', 'CTP', 'active');

-- Insert 5 Feedback Boxes
INSERT OR IGNORE INTO feedback_boxes (id, organization_id, box_code, title, description, public_enabled)
VALUES
  ('box-canteen', 'org-cantec-001', 'CTP-CANTEEN', 'Canteen Feedback Box', 'Feedback for canteen cafeteria, food quality, menus, and dining hygiene.', 1),
  ('box-production', 'org-cantec-001', 'CTP-PRODUCTION', 'Production Floor Box', 'Suggestions and complaints regarding factory floor, machinery, and lighting.', 1),
  ('box-general', 'org-cantec-001', 'CTP-GENERAL', 'General Suggestion Box', 'General feedback, workplace ideas, and overall improvements.', 1),
  ('box-hr', 'org-cantec-001', 'CTP-HR', 'HR Suggestion Box', 'Human resources, employee welfare, workplace climate, and staff concerns.', 1),
  ('box-maintenance', 'org-cantec-001', 'CTP-MAINTENANCE', 'Maintenance Box', 'Facilities maintenance, repairs, washrooms, HVAC, and parking.', 1);

-- Insert Default Operators
-- admin / password123 (hash: f42a7bb862ba94a4c6a959082eb4c9fb60e34c9c1ef3a31c5d9e504c54143ca3 with salt: cantec_salt_123)
-- operator / cantec2026 (hash: 7d6c6aa3fd8fef499119cff74a5840bc2b885ffae6a33758117769931b26f5f3 with salt: op_salt_456)
INSERT OR IGNORE INTO operators (id, organization_id, username, password_hash, password_salt, role, status)
VALUES
  ('op-admin-1', 'org-cantec-001', 'admin', 'f42a7bb862ba94a4c6a959082eb4c9fb60e34c9c1ef3a31c5d9e504c54143ca3', 'cantec_salt_123', 'admin', 'active'),
  ('op-staff-1', 'org-cantec-001', 'operator', '7d6c6aa3fd8fef499119cff74a5840bc2b885ffae6a33758117769931b26f5f3', 'op_salt_456', 'operator', 'active');

-- Insert Initial Seed Groups
INSERT OR IGNORE INTO feedback_groups (id, organization_id, feedback_box_id, type, title, description, status)
VALUES
  ('grp-canteen-food', 'org-cantec-001', 'box-canteen', 'suggestion', 'Improve Canteen Food', 'Multiple staff requests for healthier options and tastier meals in cafeteria.', 'Active'),
  ('grp-parking', 'org-cantec-001', 'box-maintenance', 'suggestion', 'Improve Parking Space & Layout', 'Morning parking bottleneck and motorcycle bay marking suggestions.', 'Under Review'),
  ('grp-lighting', 'org-cantec-001', 'box-production', 'suggestion', 'Better Production Lighting', 'Requests for LED overhead luminaires near printing press line 3.', 'Active'),
  ('grp-washroom', 'org-cantec-001', 'box-maintenance', 'complaint', 'Washroom Cleanliness & Odor', 'Complaints about 2nd floor washroom hygiene during shift changeovers.', 'Active');
