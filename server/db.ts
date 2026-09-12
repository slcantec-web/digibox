import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  DailyReport,
  FeedbackBox,
  FeedbackGroup,
  FeedbackNote,
  Operator,
  Organization,
  StatisticsData,
  Submission,
  SubmissionGroupMember,
  SubmissionStatus,
  SubmissionType,
} from '../src/types.js';

export interface Session {
  id: string;
  operator_id: string;
  session_hash: string;
  expires_at: string;
  created_at: string;
  last_activity_at: string;
}

export interface PasswordResetLog {
  id: string;
  operator_id: string;
  username: string;
  reset_by: 'self' | 'admin' | 'org_code';
  ip_address?: string;
  status: 'success' | 'failed';
  created_at: string;
}

export interface AuditLog {
  id: string;
  organization_id: string;
  actor_id?: string;
  actor_username?: string;
  action: string;
  details?: string;
  ip_address?: string;
  created_at: string;
}

interface DatabaseSchema {
  organizations: Organization[];
  feedback_boxes: FeedbackBox[];
  operators: (Operator & { password_hash: string; password_salt: string })[];
  submissions: Submission[];
  feedback_groups: FeedbackGroup[];
  submission_group_members: SubmissionGroupMember[];
  feedback_notes: FeedbackNote[];
  sessions: Session[];
  daily_reports: DailyReport[];
  password_reset_logs: PasswordResetLog[];
  audit_logs: AuditLog[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Helper to hash strings with SHA-256
export function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export function hashPassword(password: string, salt: string): string {
  return crypto.createHash('sha256').update(password + ':' + salt).digest('hex');
}

class D1DatabaseStore {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.loadOrInitialize();
  }

  private loadOrInitialize(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(content);
        parsed.password_reset_logs = parsed.password_reset_logs || [];
        parsed.audit_logs = parsed.audit_logs || [];
        return parsed;
      }
    } catch (err) {
      console.warn('Failed to read database file, initializing default seed', err);
    }
    const seeded = this.createInitialSeed();
    this.saveData(seeded);
    return seeded;
  }

  private saveData(dataToSave = this.data) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(dataToSave, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write database file', err);
    }
  }

  public resetToSeed(): DatabaseSchema {
    const seeded = this.createInitialSeed();
    this.data = seeded;
    this.saveData();
    return seeded;
  }

  public createInitialSeed(): DatabaseSchema {
    const now = new Date().toISOString();
    const orgId = 'org-cantec-001';

    const org: Organization = {
      id: orgId,
      name: 'Cantec Printing & Packaging',
      code: 'CTP',
      status: 'active',
      contact_email: 'management@cantec.lk',
      welcome_message: 'Welcome to our Digital Feedback Box. Your voice helps us improve everyday.',
      thank_you_message: 'Thank you for your valuable feedback! Our management team reviews all submissions promptly.',
      created_at: now,
      updated_at: now,
    };

    const boxes: FeedbackBox[] = [
      {
        id: 'box-canteen',
        organization_id: orgId,
        box_code: 'CTP-CANTEEN',
        title: 'Canteen Feedback Box',
        description: 'Feedback for canteen cafeteria, food quality, menus, and dining hygiene.',
        public_enabled: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'box-production',
        organization_id: orgId,
        box_code: 'CTP-PRODUCTION',
        title: 'Production Floor Box',
        description: 'Suggestions and complaints regarding factory floor, machinery, and lighting.',
        public_enabled: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'box-general',
        organization_id: orgId,
        box_code: 'CTP-GENERAL',
        title: 'General Suggestion Box',
        description: 'General feedback, workplace ideas, and overall improvements.',
        public_enabled: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'box-hr',
        organization_id: orgId,
        box_code: 'CTP-HR',
        title: 'HR Suggestion Box',
        description: 'Human resources, employee welfare, workplace climate, and staff concerns.',
        public_enabled: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'box-maintenance',
        organization_id: orgId,
        box_code: 'CTP-MAINTENANCE',
        title: 'Maintenance Box',
        description: 'Facilities maintenance, repairs, washrooms, HVAC, and parking.',
        public_enabled: true,
        created_at: now,
        updated_at: now,
      },
    ];

    const adminSalt = 'cantec_salt_123';
    const adminHash = hashPassword('password123', adminSalt);
    const opSalt = 'op_salt_456';
    const opHash = hashPassword('cantec2026', opSalt);

    const operators = [
      {
        id: 'op-admin-1',
        organization_id: orgId,
        username: 'admin',
        password_hash: adminHash,
        password_salt: adminSalt,
        role: 'admin' as const,
        status: 'active' as const,
        created_at: now,
        last_login_at: now,
      },
      {
        id: 'op-staff-1',
        organization_id: orgId,
        username: 'operator',
        password_hash: opHash,
        password_salt: opSalt,
        role: 'operator' as const,
        status: 'active' as const,
        created_at: now,
        last_login_at: now,
      },
    ];

    // Seed groups
    const groupCanteen: FeedbackGroup = {
      id: 'grp-canteen-food',
      organization_id: orgId,
      feedback_box_id: 'box-canteen',
      type: 'suggestion',
      title: 'Improve Canteen Food',
      description: 'Multiple staff requests for healthier options and tastier meals in cafeteria.',
      status: 'Active',
      created_at: now,
      updated_at: now,
      submission_count: 25,
      estimated_devices: 18,
    };

    const groupParking: FeedbackGroup = {
      id: 'grp-parking',
      organization_id: orgId,
      feedback_box_id: 'box-maintenance',
      type: 'suggestion',
      title: 'Improve Parking Space & Layout',
      description: 'Morning parking bottleneck and motorcycle bay marking suggestions.',
      status: 'Under Review',
      created_at: now,
      updated_at: now,
      submission_count: 12,
      estimated_devices: 11,
    };

    const groupLighting: FeedbackGroup = {
      id: 'grp-lighting',
      organization_id: orgId,
      feedback_box_id: 'box-production',
      type: 'suggestion',
      title: 'Better Production Lighting',
      description: 'Requests for LED overhead luminaires near printing press line 3.',
      status: 'Active',
      created_at: now,
      updated_at: now,
      submission_count: 8,
      estimated_devices: 7,
    };

    const groupWashroom: FeedbackGroup = {
      id: 'grp-washroom',
      organization_id: orgId,
      feedback_box_id: 'box-maintenance',
      type: 'complaint',
      title: 'Washroom Cleanliness & Odor',
      description: 'Complaints about 2nd floor washroom hygiene during shift changeovers.',
      status: 'Active',
      created_at: now,
      updated_at: now,
      submission_count: 6,
      estimated_devices: 5,
    };

    const feedback_groups = [groupCanteen, groupParking, groupLighting, groupWashroom];
    const submissions: Submission[] = [];
    const submission_group_members: SubmissionGroupMember[] = [];
    const feedback_notes: FeedbackNote[] = [];

    // Helper to generate consistent pseudo device tokens
    const getDeviceToken = (index: number) => sha256(`device_seed_token_${index}`);

    let subIndex = 100;

    // 1. Seed 25 submissions for "Improve canteen food" (18 unique devices)
    const canteenVariations = [
      'Please improve the canteen food.',
      'Improve canteen food',
      'Food quality should be improved in the canteen.',
      'Please make the canteen food better with healthier options.',
      'Improve canteen food variety and freshness.',
    ];

    for (let i = 0; i < 25; i++) {
      subIndex++;
      const subId = `FB-${String(subIndex).padStart(6, '0')}`;
      const deviceNum = (i % 18) + 1; // 1 to 18 devices
      const text = canteenVariations[i % canteenVariations.length];
      const submittedDate = new Date(Date.now() - (25 - i) * 3600 * 1000 * 3).toISOString();

      const sub: Submission = {
        id: subId,
        organization_id: orgId,
        feedback_box_id: 'box-canteen',
        feedback_box_title: 'Canteen Feedback Box',
        feedback_box_code: 'CTP-CANTEEN',
        type: 'suggestion',
        message: text,
        submitter_name: i % 4 === 0 ? 'Shift A Worker' : undefined,
        submitter_contact: undefined,
        is_anonymous: i % 4 !== 0,
        device_token_hash: getDeviceToken(deviceNum),
        message_hash: sha256(text.trim().toLowerCase()),
        status: i < 5 ? 'Accepted' : i < 15 ? 'Reviewing' : 'New',
        submitted_at: submittedDate,
        updated_at: submittedDate,
        group_id: groupCanteen.id,
        group_title: groupCanteen.title,
      };

      submissions.push(sub);
      submission_group_members.push({
        id: `sgm-${subId}`,
        submission_id: subId,
        group_id: groupCanteen.id,
        created_at: submittedDate,
      });
    }

    // Add an operator note to FB-000101
    feedback_notes.push({
      id: 'fn-1',
      submission_id: 'FB-000101',
      operator_id: 'op-admin-1',
      operator_name: 'admin',
      note: 'Discussed with canteen vendor; menu revision scheduled for next Monday.',
      created_at: now,
      updated_at: now,
    });

    // 2. Seed 12 submissions for "Improve parking" (11 unique devices)
    for (let i = 0; i < 12; i++) {
      subIndex++;
      const subId = `FB-${String(subIndex).padStart(6, '0')}`;
      const deviceNum = 100 + (i % 11);
      const text = i % 2 === 0 ? 'Improve parking lot markings and motorcycle spaces.' : 'Improve parking space in morning.';
      const submittedDate = new Date(Date.now() - (15 - i) * 3600 * 1000 * 5).toISOString();

      const sub: Submission = {
        id: subId,
        organization_id: orgId,
        feedback_box_id: 'box-maintenance',
        feedback_box_title: 'Maintenance Box',
        feedback_box_code: 'CTP-MAINTENANCE',
        type: 'suggestion',
        message: text,
        is_anonymous: true,
        device_token_hash: getDeviceToken(deviceNum),
        message_hash: sha256(text.trim().toLowerCase()),
        status: 'In Progress',
        submitted_at: submittedDate,
        updated_at: submittedDate,
        group_id: groupParking.id,
        group_title: groupParking.title,
      };

      submissions.push(sub);
      submission_group_members.push({
        id: `sgm-${subId}`,
        submission_id: subId,
        group_id: groupParking.id,
        created_at: submittedDate,
      });
    }

    // 3. Seed 8 submissions for "Better production lighting" (7 unique devices)
    for (let i = 0; i < 8; i++) {
      subIndex++;
      const subId = `FB-${String(subIndex).padStart(6, '0')}`;
      const deviceNum = 200 + (i % 7);
      const text = 'Please improve the lighting in the production area near press line 3.';
      const submittedDate = new Date(Date.now() - (10 - i) * 3600 * 1000 * 4).toISOString();

      const sub: Submission = {
        id: subId,
        organization_id: orgId,
        feedback_box_id: 'box-production',
        feedback_box_title: 'Production Floor Box',
        feedback_box_code: 'CTP-PRODUCTION',
        type: 'suggestion',
        message: text,
        is_anonymous: true,
        device_token_hash: getDeviceToken(deviceNum),
        message_hash: sha256(text.trim().toLowerCase()),
        status: 'Accepted',
        submitted_at: submittedDate,
        updated_at: submittedDate,
        group_id: groupLighting.id,
        group_title: groupLighting.title,
      };

      submissions.push(sub);
      submission_group_members.push({
        id: `sgm-${subId}`,
        submission_id: subId,
        group_id: groupLighting.id,
        created_at: submittedDate,
      });
    }

    feedback_notes.push({
      id: 'fn-2',
      submission_id: submissions[submissions.length - 1].id,
      operator_id: 'op-admin-1',
      operator_name: 'admin',
      note: 'Discussed with maintenance department. LED replacement planned next week.',
      created_at: now,
      updated_at: now,
    });

    // 4. Seed 6 complaints for Washroom cleanliness (5 devices)
    for (let i = 0; i < 6; i++) {
      subIndex++;
      const subId = `FB-${String(subIndex).padStart(6, '0')}`;
      const deviceNum = 300 + (i % 5);
      const text = 'Washroom cleaning issue on 2nd floor. Soap dispenser empty and floor slippery.';
      const submittedDate = new Date(Date.now() - (6 - i) * 3600 * 1000 * 8).toISOString();

      const sub: Submission = {
        id: subId,
        organization_id: orgId,
        feedback_box_id: 'box-maintenance',
        feedback_box_title: 'Maintenance Box',
        feedback_box_code: 'CTP-MAINTENANCE',
        type: 'complaint',
        message: text,
        is_anonymous: true,
        device_token_hash: getDeviceToken(deviceNum),
        message_hash: sha256(text.trim().toLowerCase()),
        status: i === 0 ? 'Action Taken' : i === 1 ? 'Under Review' : 'New',
        submitted_at: submittedDate,
        updated_at: submittedDate,
        group_id: groupWashroom.id,
        group_title: groupWashroom.title,
      };

      submissions.push(sub);
      submission_group_members.push({
        id: `sgm-${subId}`,
        submission_id: subId,
        group_id: groupWashroom.id,
        created_at: submittedDate,
      });
    }

    // 5. Seed some unassigned complaints and suggestions
    const additionalFeedbacks = [
      {
        type: 'complaint' as const,
        box: 'box-production',
        text: 'Excessive vibration on cutter unit 4 causing uneven edges.',
        status: 'Investigating' as const,
        name: 'Quality Inspector Lim',
        contact: 'ext-4412',
      },
      {
        type: 'complaint' as const,
        box: 'box-canteen',
        text: 'Canteen service is too slow during peak 12:30pm lunch rush.',
        status: 'Under Review' as const,
        name: undefined,
        contact: undefined,
      },
      {
        type: 'complaint' as const,
        box: 'box-maintenance',
        text: 'Parking obstruction: delivery trucks blocking the pedestrian walkway.',
        status: 'Resolved' as const,
        name: undefined,
        contact: undefined,
      },
      {
        type: 'suggestion' as const,
        box: 'box-general',
        text: 'Can we install water dispensers closer to the packaging line?',
        status: 'Accepted' as const,
        name: 'Packaging Team',
        contact: undefined,
      },
      {
        type: 'suggestion' as const,
        box: 'box-hr',
        text: 'Consider organizing an ergonomic posture workshop for warehouse staff.',
        status: 'New' as const,
        name: undefined,
        contact: undefined,
      },
      {
        type: 'suggestion' as const,
        box: 'box-canteen',
        text: 'Please add a vegetarian noodle option in the daily lunch menu.',
        status: 'New' as const,
        name: undefined,
        contact: undefined,
      },
    ];

    additionalFeedbacks.forEach((af, idx) => {
      subIndex++;
      const subId = `FB-${String(subIndex).padStart(6, '0')}`;
      const deviceNum = 400 + idx;
      const submittedDate = new Date(Date.now() - (12 - idx) * 3600 * 1000 * 4).toISOString();
      const boxObj = boxes.find((b) => b.id === af.box)!;

      submissions.push({
        id: subId,
        organization_id: orgId,
        feedback_box_id: boxObj.id,
        feedback_box_title: boxObj.title,
        feedback_box_code: boxObj.box_code,
        type: af.type,
        message: af.text,
        submitter_name: af.name,
        submitter_contact: af.contact,
        is_anonymous: !af.name,
        device_token_hash: getDeviceToken(deviceNum),
        message_hash: sha256(af.text.trim().toLowerCase()),
        status: af.status,
        submitted_at: submittedDate,
        updated_at: submittedDate,
        group_id: null,
      });
    });

    return {
      organizations: [org],
      feedback_boxes: boxes,
      operators,
      submissions,
      feedback_groups,
      submission_group_members,
      feedback_notes,
      sessions: [],
      daily_reports: [],
      password_reset_logs: [],
      audit_logs: [],
    };
  }

  // --- Database Methods ---

  public logPasswordReset(data: {
    operator_id: string;
    username: string;
    reset_by: 'self' | 'admin' | 'org_code';
    ip_address?: string;
    status?: 'success' | 'failed';
  }): PasswordResetLog {
    const entry: PasswordResetLog = {
      id: `prl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      operator_id: data.operator_id,
      username: data.username,
      reset_by: data.reset_by,
      ip_address: data.ip_address,
      status: data.status || 'success',
      created_at: new Date().toISOString(),
    };
    this.data.password_reset_logs = this.data.password_reset_logs || [];
    this.data.password_reset_logs.unshift(entry);
    this.saveData();
    return entry;
  }

  public logAudit(data: {
    organization_id: string;
    actor_id?: string;
    actor_username?: string;
    action: string;
    details?: string;
    ip_address?: string;
  }): AuditLog {
    const entry: AuditLog = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      organization_id: data.organization_id,
      actor_id: data.actor_id,
      actor_username: data.actor_username,
      action: data.action,
      details: data.details,
      ip_address: data.ip_address,
      created_at: new Date().toISOString(),
    };
    this.data.audit_logs = this.data.audit_logs || [];
    this.data.audit_logs.unshift(entry);
    this.saveData();
    return entry;
  }

  public listAuditLogs(organizationId: string, limit = 50): AuditLog[] {
    this.data.audit_logs = this.data.audit_logs || [];
    return this.data.audit_logs
      .filter((a) => a.organization_id === organizationId)
      .slice(0, limit);
  }

  public listPasswordResetLogs(operatorId?: string, limit = 50): PasswordResetLog[] {
    this.data.password_reset_logs = this.data.password_reset_logs || [];
    if (operatorId) {
      return this.data.password_reset_logs
        .filter((l) => l.operator_id === operatorId)
        .slice(0, limit);
    }
    return this.data.password_reset_logs.slice(0, limit);
  }

  public getOrganization(id: string): Organization | undefined {
    return this.data.organizations.find((o) => o.id === id);
  }

  public getOrganizationByCode(code: string): Organization | undefined {
    return this.data.organizations.find((o) => o.code.toUpperCase() === code.toUpperCase());
  }

  public getFeedbackBoxByCode(code: string): FeedbackBox | undefined {
    return this.data.feedback_boxes.find((b) => b.box_code.toUpperCase() === code.toUpperCase());
  }

  public getFeedbackBoxes(orgId: string): FeedbackBox[] {
    return this.data.feedback_boxes.filter((b) => b.organization_id === orgId && b.public_enabled);
  }

  public getAllFeedbackBoxes(orgId: string): FeedbackBox[] {
    return this.data.feedback_boxes.filter((b) => b.organization_id === orgId);
  }

  public createFeedbackBox(payload: {
    organization_id: string;
    box_code: string;
    title: string;
    description?: string;
    public_enabled?: boolean;
  }): FeedbackBox {
    const existing = this.getFeedbackBoxByCode(payload.box_code);
    if (existing) {
      throw new Error(`Feedback box with code "${payload.box_code}" already exists.`);
    }
    const now = new Date().toISOString();
    const box: FeedbackBox = {
      id: `box-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      organization_id: payload.organization_id,
      box_code: payload.box_code.trim().toUpperCase(),
      title: payload.title.trim(),
      description: payload.description?.trim() || '',
      public_enabled: payload.public_enabled !== false,
      created_at: now,
      updated_at: now,
    };
    this.data.feedback_boxes.push(box);
    this.saveData();
    return box;
  }

  public updateFeedbackBox(
    id: string,
    orgId: string,
    updates: Partial<Pick<FeedbackBox, 'title' | 'description' | 'public_enabled' | 'box_code'>>
  ): FeedbackBox | undefined {
    const box = this.data.feedback_boxes.find((b) => b.id === id && b.organization_id === orgId);
    if (!box) return undefined;
    if (updates.title !== undefined) box.title = updates.title.trim();
    if (updates.description !== undefined) box.description = updates.description.trim();
    if (updates.public_enabled !== undefined) box.public_enabled = updates.public_enabled;
    if (updates.box_code !== undefined) {
      const code = updates.box_code.trim().toUpperCase();
      const duplicate = this.data.feedback_boxes.find(
        (b) => b.box_code.toUpperCase() === code && b.id !== id
      );
      if (duplicate) {
        throw new Error(`Box code "${code}" is already in use.`);
      }
      box.box_code = code;
    }
    box.updated_at = new Date().toISOString();
    this.saveData();
    return box;
  }

  public deleteFeedbackBox(id: string, orgId: string): boolean {
    const initialLen = this.data.feedback_boxes.length;
    this.data.feedback_boxes = this.data.feedback_boxes.filter(
      (b) => !(b.id === id && b.organization_id === orgId)
    );
    if (this.data.feedback_boxes.length !== initialLen) {
      this.saveData();
      return true;
    }
    return false;
  }

  public deleteSubmission(id: string, orgId: string): boolean {
    const index = this.data.submissions.findIndex((s) => s.id === id && s.organization_id === orgId);
    if (index === -1) return false;
    this.data.submissions.splice(index, 1);
    this.data.feedback_notes = this.data.feedback_notes.filter((n) => n.submission_id !== id);
    this.data.submission_group_members = this.data.submission_group_members.filter((m) => m.submission_id !== id);
    this.saveData();
    return true;
  }

  public listOperators(orgId: string) {
    return this.data.operators
      .filter((op) => op.organization_id === orgId)
      .map(({ password_hash, password_salt, ...safe }) => safe);
  }

  public createOperator(payload: {
    organization_id: string;
    username: string;
    password: string;
    role: 'admin' | 'operator';
  }) {
    const existing = this.getOperatorByUsername(payload.username);
    if (existing) {
      throw new Error(`Username "${payload.username}" is already taken.`);
    }
    const now = new Date().toISOString();
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(payload.password, salt);
    const newOp = {
      id: `op-${Date.now()}`,
      organization_id: payload.organization_id,
      username: payload.username.trim().toLowerCase(),
      password_hash: hash,
      password_salt: salt,
      role: payload.role || 'operator',
      status: 'active' as const,
      created_at: now,
      last_login_at: undefined,
    };
    this.data.operators.push(newOp);
    this.saveData();
    const { password_hash, password_salt, ...safe } = newOp;
    return safe;
  }

  public updateOperator(
    id: string,
    orgId: string,
    updates: {
      role?: 'admin' | 'operator';
      status?: 'active' | 'inactive';
      password?: string;
    }
  ) {
    const op = this.data.operators.find((o) => o.id === id && o.organization_id === orgId);
    if (!op) return undefined;
    if (updates.role) op.role = updates.role;
    if (updates.status) op.status = updates.status;
    if (updates.password && updates.password.trim()) {
      op.password_salt = crypto.randomBytes(16).toString('hex');
      op.password_hash = hashPassword(updates.password.trim(), op.password_salt);
    }
    this.saveData();
    const { password_hash, password_salt, ...safe } = op;
    return safe;
  }

  public deleteOperator(id: string, orgId: string): boolean {
    const index = this.data.operators.findIndex((o) => o.id === id && o.organization_id === orgId);
    if (index === -1) return false;
    this.data.operators.splice(index, 1);
    this.saveData();
    return true;
  }

  public updateOrganization(
    id: string,
    updates: Partial<Pick<Organization, 'name' | 'code' | 'contact_email' | 'welcome_message' | 'thank_you_message'>>
  ): Organization | undefined {
    const org = this.data.organizations.find((o) => o.id === id);
    if (!org) return undefined;
    if (updates.name !== undefined) org.name = updates.name.trim();
    if (updates.code !== undefined) org.code = updates.code.trim().toUpperCase();
    if (updates.contact_email !== undefined) org.contact_email = updates.contact_email.trim();
    if (updates.welcome_message !== undefined) org.welcome_message = updates.welcome_message.trim();
    if (updates.thank_you_message !== undefined) org.thank_you_message = updates.thank_you_message.trim();
    org.updated_at = new Date().toISOString();
    this.saveData();
    return org;
  }

  public getOperatorByUsername(username: string) {
    return this.data.operators.find((op) => op.username.toLowerCase() === username.toLowerCase());
  }

  public getOperatorById(id: string) {
    return this.data.operators.find((op) => op.id === id);
  }

  public createSession(operatorId: string): Session {
    const now = new Date();
    const expires = new Date(now.getTime() + 7 * 24 * 3600 * 1000); // 7 days
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const session: Session = {
      id: sessionToken,
      operator_id: operatorId,
      session_hash: sha256(sessionToken),
      created_at: now.toISOString(),
      expires_at: expires.toISOString(),
      last_activity_at: now.toISOString(),
    };
    this.data.sessions.push(session);
    this.saveData();
    return session;
  }

  public getSession(sessionId: string): Session | undefined {
    const session = this.data.sessions.find((s) => s.id === sessionId);
    if (!session) return undefined;
    if (new Date(session.expires_at).getTime() < Date.now()) {
      this.deleteSession(sessionId);
      return undefined;
    }
    session.last_activity_at = new Date().toISOString();
    return session;
  }

  public deleteSession(sessionId: string) {
    this.data.sessions = this.data.sessions.filter((s) => s.id !== sessionId);
    this.saveData();
  }

  // --- Submissions ---

  public createSubmission(payload: {
    organization_id: string;
    feedback_box_id: string;
    type: SubmissionType;
    message: string;
    submitter_name?: string;
    submitter_contact?: string;
    is_anonymous: boolean;
    device_token: string;
    security_ip?: string;
  }): Submission {
    const now = new Date().toISOString();
    const nextSeq = this.data.submissions.length + 101;
    const subId = `FB-${String(nextSeq).padStart(6, '0')}`;

    const box = this.data.feedback_boxes.find((b) => b.id === payload.feedback_box_id);
    const tokenHash = sha256(payload.device_token || 'anon_device_' + Date.now());
    const msgHash = sha256(payload.message.trim().toLowerCase());

    const submission: Submission = {
      id: subId,
      organization_id: payload.organization_id,
      feedback_box_id: payload.feedback_box_id,
      feedback_box_title: box?.title,
      feedback_box_code: box?.box_code,
      type: payload.type,
      message: payload.message.trim(),
      submitter_name: payload.is_anonymous ? undefined : payload.submitter_name?.trim() || undefined,
      submitter_contact: payload.is_anonymous ? undefined : payload.submitter_contact?.trim() || undefined,
      is_anonymous: payload.is_anonymous,
      device_token_hash: tokenHash,
      security_hash: payload.security_ip ? sha256(payload.security_ip) : undefined,
      message_hash: msgHash,
      status: 'New',
      submitted_at: now,
      updated_at: now,
      group_id: null,
    };

    // Auto-match existing group if exact title or previous submissions match
    const existingGroup = this.data.feedback_groups.find(
      (g) =>
        g.organization_id === payload.organization_id &&
        g.type === payload.type &&
        (g.title.toLowerCase() === payload.message.trim().toLowerCase() ||
          payload.message.trim().toLowerCase().includes(g.title.toLowerCase()))
    );

    if (existingGroup) {
      submission.group_id = existingGroup.id;
      submission.group_title = existingGroup.title;
      this.data.submission_group_members.push({
        id: `sgm-${subId}`,
        submission_id: subId,
        group_id: existingGroup.id,
        created_at: now,
      });
    }

    this.data.submissions.unshift(submission);
    this.saveData();
    return submission;
  }

  public getSubmission(id: string, orgId: string): Submission | undefined {
    const sub = this.data.submissions.find((s) => s.id === id && s.organization_id === orgId);
    if (!sub) return undefined;
    return this.enrichSubmission(sub);
  }

  public updateSubmissionStatus(id: string, orgId: string, status: SubmissionStatus): Submission | undefined {
    const sub = this.data.submissions.find((s) => s.id === id && s.organization_id === orgId);
    if (!sub) return undefined;
    sub.status = status;
    sub.updated_at = new Date().toISOString();
    this.saveData();
    return this.enrichSubmission(sub);
  }

  public assignSubmissionGroup(id: string, orgId: string, groupId: string | null): Submission | undefined {
    const sub = this.data.submissions.find((s) => s.id === id && s.organization_id === orgId);
    if (!sub) return undefined;

    // Remove existing membership
    this.data.submission_group_members = this.data.submission_group_members.filter((m) => m.submission_id !== id);

    if (groupId) {
      const group = this.data.feedback_groups.find((g) => g.id === groupId && g.organization_id === orgId);
      if (group) {
        sub.group_id = group.id;
        sub.group_title = group.title;
        this.data.submission_group_members.push({
          id: `sgm-${id}`,
          submission_id: id,
          group_id: group.id,
          created_at: new Date().toISOString(),
        });
      }
    } else {
      sub.group_id = null;
      sub.group_title = null;
    }

    sub.updated_at = new Date().toISOString();
    this.saveData();
    return this.enrichSubmission(sub);
  }

  public addNote(submissionId: string, operatorId: string, noteText: string): FeedbackNote {
    const op = this.getOperatorById(operatorId);
    const note: FeedbackNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      submission_id: submissionId,
      operator_id: operatorId,
      operator_name: op?.username || 'Operator',
      note: noteText.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.data.feedback_notes.push(note);
    this.saveData();
    return note;
  }

  public getNotes(submissionId: string): FeedbackNote[] {
    return this.data.feedback_notes
      .filter((n) => n.submission_id === submissionId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  private enrichSubmission(sub: Submission): Submission {
    const box = this.data.feedback_boxes.find((b) => b.id === sub.feedback_box_id);
    const notes = this.data.feedback_notes.filter((n) => n.submission_id === sub.id);

    // Compute duplicates and estimated unique devices
    let relatedSubs: Submission[] = [];
    if (sub.group_id) {
      const groupMemberIds = new Set(
        this.data.submission_group_members.filter((m) => m.group_id === sub.group_id).map((m) => m.submission_id)
      );
      relatedSubs = this.data.submissions.filter((s) => groupMemberIds.has(s.id));
    } else {
      relatedSubs = this.data.submissions.filter(
        (s) => s.organization_id === sub.organization_id && s.message_hash === sub.message_hash
      );
    }

    const uniqueDevices = new Set(relatedSubs.map((s) => s.device_token_hash));

    const group = sub.group_id
      ? this.data.feedback_groups.find((g) => g.id === sub.group_id)
      : undefined;

    return {
      ...sub,
      feedback_box_title: box?.title || sub.feedback_box_title,
      feedback_box_code: box?.box_code || sub.feedback_box_code,
      duplicate_count: relatedSubs.length,
      estimated_devices_count: uniqueDevices.size,
      group_title: group?.title || sub.group_title,
      notes_count: notes.length,
    };
  }

  public listSubmissions(
    orgId: string,
    filters: {
      type?: string;
      status?: string;
      feedback_box_id?: string;
      group_id?: string;
      search?: string;
      date_from?: string;
      date_to?: string;
      page?: number;
      limit?: number;
    }
  ): { submissions: Submission[]; total: number; page: number; limit: number; totalPages: number } {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 25));

    let list = this.data.submissions.filter((s) => s.organization_id === orgId);

    if (filters.type && filters.type !== 'all') {
      list = list.filter((s) => s.type === filters.type);
    }

    if (filters.status && filters.status !== 'all') {
      list = list.filter((s) => s.status.toLowerCase() === filters.status?.toLowerCase());
    }

    if (filters.feedback_box_id && filters.feedback_box_id !== 'all') {
      list = list.filter((s) => s.feedback_box_id === filters.feedback_box_id);
    }

    if (filters.group_id && filters.group_id !== 'all') {
      const memberIds = new Set(
        this.data.submission_group_members.filter((m) => m.group_id === filters.group_id).map((m) => m.submission_id)
      );
      list = list.filter((s) => memberIds.has(s.id));
    }

    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.message.toLowerCase().includes(q) ||
          (s.submitter_name && s.submitter_name.toLowerCase().includes(q)) ||
          (s.submitter_contact && s.submitter_contact.toLowerCase().includes(q)) ||
          s.id.toLowerCase().includes(q)
      );
    }

    if (filters.date_from) {
      list = list.filter((s) => new Date(s.submitted_at) >= new Date(filters.date_from!));
    }

    if (filters.date_to) {
      list = list.filter((s) => new Date(s.submitted_at) <= new Date(filters.date_to!));
    }

    const total = list.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const pagedItems = list.slice(startIndex, startIndex + limit).map((s) => this.enrichSubmission(s));

    return {
      submissions: pagedItems,
      total,
      page,
      limit,
      totalPages,
    };
  }

  // --- Groups ---

  public listGroups(orgId: string, type?: SubmissionType): FeedbackGroup[] {
    return this.data.feedback_groups
      .filter((g) => g.organization_id === orgId && (!type || g.type === type))
      .map((g) => {
        const memberIds = new Set(
          this.data.submission_group_members.filter((m) => m.group_id === g.id).map((m) => m.submission_id)
        );
        const members = this.data.submissions.filter((s) => memberIds.has(s.id));
        const uniqueDevices = new Set(members.map((s) => s.device_token_hash));
        return {
          ...g,
          submission_count: members.length,
          estimated_devices: uniqueDevices.size,
          sample_messages: members.slice(0, 3).map((m) => m.message),
        };
      })
      .sort((a, b) => b.submission_count - a.submission_count);
  }

  public createGroup(payload: {
    organization_id: string;
    type: SubmissionType;
    title: string;
    description?: string;
    feedback_box_id?: string;
    initial_submission_ids?: string[];
  }): FeedbackGroup {
    const now = new Date().toISOString();
    const id = `grp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const group: FeedbackGroup = {
      id,
      organization_id: payload.organization_id,
      feedback_box_id: payload.feedback_box_id,
      type: payload.type,
      title: payload.title.trim(),
      description: payload.description?.trim(),
      status: 'Active',
      created_at: now,
      updated_at: now,
      submission_count: payload.initial_submission_ids?.length || 0,
      estimated_devices: 0,
    };

    this.data.feedback_groups.push(group);

    if (payload.initial_submission_ids && payload.initial_submission_ids.length > 0) {
      payload.initial_submission_ids.forEach((subId) => {
        const sub = this.data.submissions.find((s) => s.id === subId && s.organization_id === payload.organization_id);
        if (sub) {
          sub.group_id = id;
          sub.group_title = group.title;
          this.data.submission_group_members.push({
            id: `sgm-${subId}`,
            submission_id: subId,
            group_id: id,
            created_at: now,
          });
        }
      });
    }

    this.saveData();
    return group;
  }

  public updateGroup(
    id: string,
    orgId: string,
    updates: { title?: string; description?: string; status?: FeedbackGroup['status'] }
  ): FeedbackGroup | undefined {
    const group = this.data.feedback_groups.find((g) => g.id === id && g.organization_id === orgId);
    if (!group) return undefined;
    if (updates.title) group.title = updates.title.trim();
    if (updates.description !== undefined) group.description = updates.description.trim();
    if (updates.status) group.status = updates.status;
    group.updated_at = new Date().toISOString();
    this.saveData();
    return group;
  }

  public deleteGroup(id: string, orgId: string): boolean {
    const index = this.data.feedback_groups.findIndex((g) => g.id === id && g.organization_id === orgId);
    if (index === -1) return false;

    // Remove group membership links, but keep all original submissions intact!
    this.data.submission_group_members = this.data.submission_group_members.filter((m) => m.group_id !== id);
    this.data.submissions.forEach((s) => {
      if (s.group_id === id) {
        s.group_id = null;
        s.group_title = null;
      }
    });

    this.data.feedback_groups.splice(index, 1);
    this.saveData();
    return true;
  }

  // --- Analytics & Statistics ---

  public getStatistics(orgId: string): StatisticsData {
    const subs = this.data.submissions.filter((s) => s.organization_id === orgId);
    const suggestions = subs.filter((s) => s.type === 'suggestion');
    const complaints = subs.filter((s) => s.type === 'complaint');

    const todayStr = new Date().toISOString().slice(0, 10);
    const todaySubs = subs.filter((s) => s.submitted_at.startsWith(todayStr));

    const allDevices = new Set(subs.map((s) => s.device_token_hash));
    const anonymousCount = subs.filter((s) => s.is_anonymous).length;
    const anonymousPercentage = subs.length > 0 ? Math.round((anonymousCount / subs.length) * 100) : 100;

    // Status counts
    const suggestion_status_counts: Record<string, number> = {};
    suggestions.forEach((s) => {
      suggestion_status_counts[s.status] = (suggestion_status_counts[s.status] || 0) + 1;
    });

    const complaint_status_counts: Record<string, number> = {};
    complaints.forEach((s) => {
      complaint_status_counts[s.status] = (complaint_status_counts[s.status] || 0) + 1;
    });

    // Top repeated suggestions
    const suggestionGroups = this.calculateRepeatedClusters(suggestions, orgId);
    const complaintGroups = this.calculateRepeatedClusters(complaints, orgId);

    // Boxes breakdown
    const boxes_breakdown = this.data.feedback_boxes
      .filter((b) => b.organization_id === orgId)
      .map((b) => {
        const boxSubs = subs.filter((s) => s.feedback_box_id === b.id);
        return {
          box_code: b.box_code,
          title: b.title,
          total: boxSubs.length,
          suggestions: boxSubs.filter((s) => s.type === 'suggestion').length,
          complaints: boxSubs.filter((s) => s.type === 'complaint').length,
        };
      });

    return {
      total_feedback: subs.length,
      total_suggestions: suggestions.length,
      total_complaints: complaints.length,
      today_feedback: todaySubs.length,
      estimated_unique_devices: allDevices.size,
      anonymous_percentage: anonymousPercentage,
      suggestion_status_counts,
      complaint_status_counts,
      top_repeated_suggestions: suggestionGroups.slice(0, 5),
      top_repeated_complaints: complaintGroups.slice(0, 5),
      boxes_breakdown,
    };
  }

  private calculateRepeatedClusters(
    items: Submission[],
    orgId: string
  ): Array<{ message: string; count: number; estimated_devices: number; group_title?: string }> {
    // Group by either group_id or normalized text
    const clusterMap = new Map<
      string,
      { label: string; subs: Submission[]; groupTitle?: string }
    >();

    items.forEach((item) => {
      let key = '';
      if (item.group_id) {
        key = 'grp:' + item.group_id;
      } else {
        key = 'msg:' + item.message.trim().toLowerCase();
      }

      if (!clusterMap.has(key)) {
        let label = item.message;
        let groupTitle = undefined;
        if (item.group_id) {
          const g = this.data.feedback_groups.find((grp) => grp.id === item.group_id);
          if (g) {
            label = g.title;
            groupTitle = g.title;
          }
        }
        clusterMap.set(key, { label, subs: [], groupTitle });
      }
      clusterMap.get(key)!.subs.push(item);
    });

    const result = Array.from(clusterMap.values()).map((cluster) => {
      const devices = new Set(cluster.subs.map((s) => s.device_token_hash));
      return {
        message: cluster.label,
        count: cluster.subs.length,
        estimated_devices: devices.size,
        group_title: cluster.groupTitle,
      };
    });

    return result.sort((a, b) => b.count - a.count);
  }

  // --- Daily Reports ---

  public getDailyReport(orgId: string, dateStr: string): DailyReport | undefined {
    return this.data.daily_reports.find(
      (r) => r.organization_id === orgId && r.report_date === dateStr && r.status === 'sent'
    );
  }

  public saveDailyReport(report: DailyReport) {
    this.data.daily_reports.unshift(report);
    this.saveData();
  }

  public listDailyReports(orgId: string): DailyReport[] {
    return this.data.daily_reports
      .filter((r) => r.organization_id === orgId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
}

export const db = new D1DatabaseStore();
