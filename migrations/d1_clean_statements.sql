CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  contact_email TEXT DEFAULT 'management@cantec.lk',
  welcome_message TEXT DEFAULT 'Welcome to our Digital Feedback Box. Your voice helps us improve everyday.',
  thank_you_message TEXT DEFAULT 'Thank you for your valuable feedback! Our management team reviews all submissions promptly.',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

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

CREATE TABLE IF NOT EXISTS operators (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_operators_org ON operators(organization_id);

CREATE TABLE IF NOT EXISTS feedback_groups (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  feedback_box_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (feedback_box_id) REFERENCES feedback_boxes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_groups_org ON feedback_groups(organization_id);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  feedback_box_id TEXT NOT NULL,
  type TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS daily_reports (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  report_date TEXT NOT NULL,
  status TEXT NOT NULL,
  recipient_email TEXT,
  sent_at TEXT,
  error_message TEXT,
  report_payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT uq_org_date UNIQUE (organization_id, report_date),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reports_org_date ON daily_reports(organization_id, report_date);

CREATE TABLE IF NOT EXISTS password_reset_logs (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  username TEXT NOT NULL,
  reset_by TEXT NOT NULL,
  ip_address TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pw_resets_op ON password_reset_logs(operator_id);
CREATE INDEX IF NOT EXISTS idx_pw_resets_date ON password_reset_logs(created_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  actor_id TEXT,
  actor_username TEXT,
  action TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(created_at);

INSERT OR IGNORE INTO organizations (id, name, code, status, contact_email, welcome_message, thank_you_message)
VALUES (
  'org-cantec-001',
  'Cantec Printing & Packaging',
  'CTP',
  'active',
  'management@cantec.lk',
  'Welcome to our Digital Feedback Box. Your voice helps us improve everyday.',
  'Thank you for your valuable feedback! Our management team reviews all submissions promptly.'
);

INSERT OR IGNORE INTO feedback_boxes (id, organization_id, box_code, title, description, public_enabled)
VALUES
  ('box-canteen', 'org-cantec-001', 'CTP-CANTEEN', 'Canteen Feedback Box', 'Feedback for canteen cafeteria, food quality, menus, and dining hygiene.', 1),
  ('box-production', 'org-cantec-001', 'CTP-PRODUCTION', 'Production Floor Box', 'Suggestions and complaints regarding factory floor, machinery, and lighting.', 1),
  ('box-general', 'org-cantec-001', 'CTP-GENERAL', 'General Suggestion Box', 'General feedback, workplace ideas, and overall improvements.', 1),
  ('box-hr', 'org-cantec-001', 'CTP-HR', 'HR Suggestion Box', 'Human resources, employee welfare, workplace climate, and staff concerns.', 1),
  ('box-maintenance', 'org-cantec-001', 'CTP-MAINTENANCE', 'Maintenance Box', 'Facilities maintenance, repairs, washrooms, HVAC, and parking.', 1);

INSERT OR REPLACE INTO operators (id, organization_id, username, password_hash, password_salt, role, status)
VALUES
  ('op-admin-1', 'org-cantec-001', 'admin', 'd64d0f6dc31a92e912fb664f0e52a29b1014bc6dd3b582b42c20832a3496ab68', 'cantec_salt_123', 'admin', 'active'),
  ('op-staff-1', 'org-cantec-001', 'operator', '9256d0405b133b23ad07141c1d7b25295f21957df17a7984b5c2dd64edbef385', 'op_salt_456', 'operator', 'active');

INSERT OR IGNORE INTO feedback_groups (id, organization_id, feedback_box_id, type, title, description, status)
VALUES
  ('grp-canteen-food', 'org-cantec-001', 'box-canteen', 'suggestion', 'Improve Canteen Food', 'Multiple staff requests for healthier options and tastier meals in cafeteria.', 'Active'),
  ('grp-parking', 'org-cantec-001', 'box-maintenance', 'suggestion', 'Improve Parking Space & Layout', 'Morning parking bottleneck and motorcycle bay marking suggestions.', 'Under Review'),
  ('grp-lighting', 'org-cantec-001', 'box-production', 'suggestion', 'Better Production Lighting', 'Requests for LED overhead luminaires near printing press line 3.', 'Active'),
  ('grp-washroom', 'org-cantec-001', 'box-maintenance', 'complaint', 'Washroom Cleanliness & Odor', 'Complaints about 2nd floor washroom hygiene during shift changeovers.', 'Active');
