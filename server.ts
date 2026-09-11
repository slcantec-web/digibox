import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { AuthenticatedRequest, requireOperatorAuth, verifyOperatorCredentials } from './server/auth.js';
import { db } from './server/db.js';
import { formatDailyEmailText, generateDailyReport } from './server/reports.js';
import { SubmissionType } from './src/types.js';

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory rate limiting map for abuse protection (Spec #13)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit = 15, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count++;
  return true;
}

// Clean up stale rate limits periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap.entries()) {
    if (now > val.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 300000);

// --- Public APIs ---

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// GET /api/public/boxes - Get available public feedback boxes
app.get('/api/public/boxes', (req, res) => {
  const org = db.getOrganizationByCode('CTP');
  if (!org) {
    return res.status(404).json({ error: 'Default organization not found' });
  }
  const boxes = db.getFeedbackBoxes(org.id);
  res.json({
    organization: {
      id: org.id,
      name: org.name,
      code: org.code,
    },
    boxes: boxes.map((b) => ({
      box_code: b.box_code,
      title: b.title,
      description: b.description,
    })),
  });
});

// GET /api/public/config - Configuration for a specific feedback box
app.get('/api/public/config', (req, res) => {
  const boxCode = String(req.query.box_code || 'CTP-GENERAL').trim().toUpperCase();
  const box = db.getFeedbackBoxByCode(boxCode);

  if (!box || !box.public_enabled) {
    return res.status(404).json({ error: 'Feedback box not found or disabled' });
  }

  const org = db.getOrganization(box.organization_id);

  res.json({
    organization: {
      name: org?.name || 'CloudBase',
      code: org?.code || 'CTP',
    },
    feedback_box: {
      box_code: box.box_code,
      title: box.title,
      description: box.description,
    },
  });
});

// POST /api/public/submissions - Submit a suggestion or complaint
app.post('/api/public/submissions', (req, res) => {
  const { box_code, type, message, name, contact, anonymous, device_token } = req.body || {};

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const tokenForRateLimit = String(device_token || clientIp).slice(0, 32);

  if (!checkRateLimit(`submit:${tokenForRateLimit}`, 15, 60000)) {
    return res.status(429).json({
      error: 'Too many submissions sent in a short time. Please wait a moment before submitting again.',
    });
  }

  if (!type || (type !== 'suggestion' && type !== 'complaint')) {
    return res.status(400).json({ error: "Invalid submission type. Must be 'suggestion' or 'complaint'." });
  }

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Please provide feedback text.' });
  }

  const cleanMessage = message.trim();
  if (cleanMessage.length < 3) {
    return res.status(400).json({ error: 'Message must be at least 3 characters long.' });
  }

  if (cleanMessage.length > 2000) {
    return res.status(400).json({ error: 'Message exceeds maximum length of 2000 characters.' });
  }

  const box = db.getFeedbackBoxByCode(String(box_code || 'CTP-GENERAL').toUpperCase());
  if (!box || !box.public_enabled) {
    return res.status(404).json({ error: 'Feedback box not found.' });
  }

  // Create submission record in database
  db.createSubmission({
    organization_id: box.organization_id,
    feedback_box_id: box.id,
    type: type as SubmissionType,
    message: cleanMessage,
    submitter_name: name,
    submitter_contact: contact,
    is_anonymous: anonymous !== false,
    device_token: String(device_token || `auto_${Date.now()}`),
    security_ip: clientIp,
  });

  // Never expose database ID, device token, internal security hash (Spec #8)
  return res.json({
    success: true,
    title: 'Thank You!',
    message: 'Your feedback has been submitted successfully. Your feedback helps us improve.',
  });
});

// --- Operator APIs ---

// POST /api/operator/login
app.post('/api/operator/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const op = verifyOperatorCredentials(String(username).trim(), String(password));
  if (!op) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const session = db.createSession(op.id);
  const org = db.getOrganization(op.organization_id);

  res.json({
    token: session.id,
    operator: {
      id: op.id,
      username: op.username,
      role: op.role,
    },
    organization: {
      id: org?.id,
      name: org?.name,
      code: org?.code,
    },
  });
});

// POST /api/operator/logout
app.post('/api/operator/logout', requireOperatorAuth, (req: AuthenticatedRequest, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    db.deleteSession(token);
  }
  res.json({ success: true, message: 'Logged out successfully.' });
});

// GET /api/operator/me
app.get('/api/operator/me', requireOperatorAuth, (req: AuthenticatedRequest, res) => {
  const org = db.getOrganization(req.operator!.organization_id);
  res.json({
    operator: req.operator,
    organization: {
      id: org?.id,
      name: org?.name,
      code: org?.code,
    },
  });
});

// GET /api/operator/submissions - Paginated and filtered submissions list
app.get('/api/operator/submissions', requireOperatorAuth, (req: AuthenticatedRequest, res) => {
  const orgId = req.operator!.organization_id;
  const {
    type,
    status,
    feedback_box_id,
    group_id,
    search,
    date_from,
    date_to,
    page,
    limit,
  } = req.query;

  const result = db.listSubmissions(orgId, {
    type: type ? String(type) : undefined,
    status: status ? String(status) : undefined,
    feedback_box_id: feedback_box_id ? String(feedback_box_id) : undefined,
    group_id: group_id ? String(group_id) : undefined,
    search: search ? String(search) : undefined,
    date_from: date_from ? String(date_from) : undefined,
    date_to: date_to ? String(date_to) : undefined,
    page: page ? parseInt(String(page), 10) : 1,
    limit: limit ? parseInt(String(limit), 10) : 25,
  });

  res.json(result);
});

// GET /api/operator/submissions/:id
app.get('/api/operator/submissions/:id', requireOperatorAuth, (req: AuthenticatedRequest, res) => {
  const orgId = req.operator!.organization_id;
  const sub = db.getSubmission(req.params.id, orgId);
  if (!sub) {
    return res.status(404).json({ error: 'Submission not found' });
  }
  const notes = db.getNotes(sub.id);
  res.json({ ...sub, notes });
});

// PATCH /api/operator/submissions/:id
app.patch('/api/operator/submissions/:id', requireOperatorAuth, (req: AuthenticatedRequest, res) => {
  const orgId = req.operator!.organization_id;
  const { status, group_id } = req.body || {};

  let updated = db.getSubmission(req.params.id, orgId);
  if (!updated) {
    return res.status(404).json({ error: 'Submission not found' });
  }

  if (status) {
    updated = db.updateSubmissionStatus(req.params.id, orgId, status);
  }

  if (group_id !== undefined) {
    updated = db.assignSubmissionGroup(req.params.id, orgId, group_id || null);
  }

  const notes = db.getNotes(req.params.id);
  res.json({ ...updated, notes });
});

// POST /api/operator/submissions/:id/notes
app.post('/api/operator/submissions/:id/notes', requireOperatorAuth, (req: AuthenticatedRequest, res) => {
  const orgId = req.operator!.organization_id;
  const sub = db.getSubmission(req.params.id, orgId);
  if (!sub) {
    return res.status(404).json({ error: 'Submission not found' });
  }

  const { note } = req.body || {};
  if (!note || !note.trim()) {
    return res.status(400).json({ error: 'Note text is required' });
  }

  const createdNote = db.addNote(sub.id, req.operator!.id, note);
  const notes = db.getNotes(sub.id);

  res.json({ success: true, note: createdNote, notes });
});

// GET /api/operator/groups
app.get('/api/operator/groups', requireOperatorAuth, (req: AuthenticatedRequest, res) => {
  const orgId = req.operator!.organization_id;
  const type = req.query.type as SubmissionType | undefined;
  const groups = db.listGroups(orgId, type);
  res.json({ groups });
});

// POST /api/operator/groups
app.post('/api/operator/groups', requireOperatorAuth, (req: AuthenticatedRequest, res) => {
  const orgId = req.operator!.organization_id;
  const { title, type, description, feedback_box_id, initial_submission_ids } = req.body || {};

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Group title is required' });
  }
  if (!type || (type !== 'suggestion' && type !== 'complaint')) {
    return res.status(400).json({ error: "Group type must be 'suggestion' or 'complaint'" });
  }

  const group = db.createGroup({
    organization_id: orgId,
    type,
    title,
    description,
    feedback_box_id,
    initial_submission_ids,
  });

  res.json({ success: true, group });
});

// PATCH /api/operator/groups/:id
app.patch('/api/operator/groups/:id', requireOperatorAuth, (req: AuthenticatedRequest, res) => {
  const orgId = req.operator!.organization_id;
  const { title, description, status } = req.body || {};

  const updated = db.updateGroup(req.params.id, orgId, { title, description, status });
  if (!updated) {
    return res.status(404).json({ error: 'Group not found' });
  }
  res.json({ success: true, group: updated });
});

// DELETE /api/operator/groups/:id
app.delete('/api/operator/groups/:id', requireOperatorAuth, (req: AuthenticatedRequest, res) => {
  const orgId = req.operator!.organization_id;
  const success = db.deleteGroup(req.params.id, orgId);
  if (!success) {
    return res.status(404).json({ error: 'Group not found' });
  }
  res.json({ success: true, message: 'Group deleted successfully (all feedback preserved).' });
});

// GET /api/operator/statistics
app.get('/api/operator/statistics', requireOperatorAuth, (req: AuthenticatedRequest, res) => {
  const orgId = req.operator!.organization_id;
  const stats = db.getStatistics(orgId);
  res.json(stats);
});

// GET /api/operator/reports
app.get('/api/operator/reports', requireOperatorAuth, (req: AuthenticatedRequest, res) => {
  const orgId = req.operator!.organization_id;
  const reports = db.listDailyReports(orgId);
  res.json({ reports });
});

// POST /api/operator/reports/daily-trigger - Cloudflare Cron Trigger Simulator
app.post('/api/operator/reports/daily-trigger', requireOperatorAuth, async (req: AuthenticatedRequest, res) => {
  const orgId = req.operator!.organization_id;
  const { date, force } = req.body || {};

  try {
    const result = await generateDailyReport(orgId, date, !!force);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Report generation failed' });
  }
});

// POST /api/operator/seed - Reset to pristine demo seed
app.post('/api/operator/seed', requireOperatorAuth, (req: AuthenticatedRequest, res) => {
  db.resetToSeed();
  res.json({ success: true, message: 'Database reset to initial sample seed successfully.' });
});

// --- Vite Middleware Integration ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CloudBase Feedback Box server running on port ${PORT}`);
  });
}

startServer();
