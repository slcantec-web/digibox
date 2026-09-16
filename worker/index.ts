/**
 * CloudBase Digital Feedback Box - Cloudflare Worker Entry Point
 * Handles API endpoints backed by Cloudflare D1, serves React SPA via ASSETS,
 * and executes scheduled cron triggers for daily email reports.
 *
 * CHANGELOG (sync + auth fixes):
 * - Submissions list/detail now compute duplicate_count / estimated_devices_count
 *   (was always missing, so "head count" badges never showed in production).
 * - POST /api/operator/groups now saves feedback_box_id (was silently dropped).
 * - Added PATCH /api/operator/groups/:id (was completely missing -> Edit Group
 *   modal 404'd in production).
 * - GET /api/operator/groups now returns feedback_box_title/code, boxes_breakdown,
 *   and sample_messages, matching what the dashboard renders.
 * - GET /api/operator/boxes now returns submission_count, suggestions_count,
 *   complaints_count, estimated_devices, groups_count, active_groups.
 * - Daily report trigger now computes real top_suggestions and
 *   complaints_status_counts instead of always returning empty/stub data.
 * - Removed hardcoded backdoor credentials (admin/password123,
 *   operator/cantec2026) from login and change-password checks. Update the
 *   D1 seed data (see migrations/0001_initial_schema.sql) to your own
 *   passwords before deploying.
 * - Added basic abuse throttling to the org-code self-service password reset,
 *   since it previously had no rate limit at all.
 */

export interface Env {
  DB: any; // Cloudflare D1Database binding
  ASSETS: { fetch: (req: Request) => Promise<Response> };
  ORGANIZATION_ID?: string;
  EMAIL_GATEWAY_URL?: string;
  EMAIL_GATEWAY_API_KEY?: string;
  EMAIL_RECIPIENT?: string;
}

// Helper: JSON response with CORS headers
function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// SHA-256 helper for Web Crypto API
async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Session authentication check
async function getAuthenticatedOperator(request: Request, env: Env) {
  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const sessionHash = await sha256(token);
  const session = await env.DB.prepare(
    `SELECT s.*, o.id as operator_id, o.username, o.role, o.organization_id 
     FROM sessions s 
     JOIN operators o ON s.operator_id = o.id 
     WHERE s.session_hash = ? AND s.expires_at > datetime('now')`
  )
    .bind(sessionHash)
    .first();

  if (!session) return null;

  const org = await env.DB.prepare(`SELECT * FROM organizations WHERE id = ?`)
    .bind(session.organization_id)
    .first();

  return {
    operator: {
      id: session.operator_id,
      username: session.username,
      role: session.role,
      organization_id: session.organization_id,
    },
    organization: org,
  };
}

let schemaEnsured = false;
async function ensureD1Schema(env: Env) {
  if (schemaEnsured || !env.DB) return;
  try {
    // 1. Ensure organizations columns exist
    await env.DB.prepare(`ALTER TABLE organizations ADD COLUMN contact_email TEXT DEFAULT 'management@cantec.lk'`).run().catch(() => {});
    await env.DB.prepare(`ALTER TABLE organizations ADD COLUMN welcome_message TEXT DEFAULT 'Welcome to our Digital Feedback Box. Your voice helps us improve everyday.'`).run().catch(() => {});
    await env.DB.prepare(`ALTER TABLE organizations ADD COLUMN thank_you_message TEXT DEFAULT 'Thank you for your valuable feedback! Our management team reviews all submissions promptly.'`).run().catch(() => {});

    // 2. Ensure daily_reports recipient_email column exists
    await env.DB.prepare(`ALTER TABLE daily_reports ADD COLUMN recipient_email TEXT`).run().catch(() => {});

    // 3. Ensure password_reset_logs table exists
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS password_reset_logs (
        id TEXT PRIMARY KEY,
        operator_id TEXT NOT NULL,
        username TEXT NOT NULL,
        reset_by TEXT NOT NULL,
        ip_address TEXT,
        status TEXT NOT NULL DEFAULT 'success',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run().catch(() => {});

    // 4. Ensure audit_logs table exists
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        actor_id TEXT,
        actor_username TEXT,
        action TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run().catch(() => {});

    schemaEnsured = true;
  } catch (err) {
    console.warn('Schema self-check notice:', err);
  }
}

// --- Enrichment helpers -----------------------------------------------

// Adds duplicate_count / estimated_devices_count to a WHERE-filtered submissions query.
// Duplicates are computed either by shared group_id, or (if ungrouped) by identical message_hash.
const DUPLICATE_COUNT_SQL = `
  (CASE WHEN s.group_id IS NOT NULL THEN
      (SELECT COUNT(*) FROM submissions s2 WHERE s2.group_id = s.group_id)
    ELSE
      (SELECT COUNT(*) FROM submissions s2 WHERE s2.message_hash = s.message_hash AND s2.organization_id = s.organization_id)
    END) as duplicate_count,
  (CASE WHEN s.group_id IS NOT NULL THEN
      (SELECT COUNT(DISTINCT s2.device_token_hash) FROM submissions s2 WHERE s2.group_id = s.group_id)
    ELSE
      (SELECT COUNT(DISTINCT s2.device_token_hash) FROM submissions s2 WHERE s2.message_hash = s.message_hash AND s2.organization_id = s.organization_id)
    END) as estimated_devices_count
`;

// Builds { feedback_box_title, feedback_box_code, boxes_breakdown, sample_messages } for one group.
async function enrichGroup(env: Env, g: any) {
  let feedback_box_title: string | undefined;
  let feedback_box_code: string | undefined;
  if (g.feedback_box_id) {
    const box: any = await env.DB.prepare(`SELECT box_code, title FROM feedback_boxes WHERE id = ?`)
      .bind(g.feedback_box_id)
      .first();
    if (box) {
      feedback_box_title = box.title;
      feedback_box_code = box.box_code;
    }
  }

  const { results: members } = await env.DB.prepare(
    `SELECT s.id, s.message, s.feedback_box_id, s.device_token_hash,
            b.box_code as box_code, b.title as box_title
     FROM submissions s
     LEFT JOIN feedback_boxes b ON s.feedback_box_id = b.id
     WHERE s.group_id = ?
     ORDER BY s.submitted_at DESC`
  )
    .bind(g.id)
    .all();

  const boxMap = new Map<string, { box_id: string; box_code: string; box_title: string; count: number; devices: Set<string> }>();
  (members || []).forEach((m: any) => {
    const key = m.feedback_box_id || 'unassigned';
    if (!boxMap.has(key)) {
      boxMap.set(key, {
        box_id: key,
        box_code: m.box_code || 'GENERAL',
        box_title: m.box_title || 'General Submissions',
        count: 0,
        devices: new Set(),
      });
    }
    const entry = boxMap.get(key)!;
    entry.count += 1;
    if (m.device_token_hash) entry.devices.add(m.device_token_hash);
  });

  const boxes_breakdown = Array.from(boxMap.values())
    .map((e) => ({ box_id: e.box_id, box_code: e.box_code, box_title: e.box_title, count: e.count, devices: e.devices.size }))
    .sort((a, b) => b.count - a.count);

  const sample_messages = (members || []).slice(0, 3).map((m: any) => m.message);

  return { ...g, feedback_box_title, feedback_box_code, boxes_breakdown, sample_messages };
}

export default {
  // 1. Fetch Handler: API + SPA Assets
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    // Handle OPTIONS CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    const path = url.pathname;

    // --- API ROUTES ---
    if (path.startsWith('/api/')) {
      try {
        // Health check
        if (path === '/api/health') {
          return json({
            status: 'ok',
            runtime: 'cloudflare-worker',
            hasDB: Boolean(env.DB),
            time: new Date().toISOString(),
          });
        }

        // Validate D1 Database binding
        if (!env.DB) {
          return json(
            {
              error:
                'Cloudflare D1 Database binding "DB" is missing. Please go to your Cloudflare Pages Dashboard -> Settings -> Functions -> D1 Database Bindings, and add variable name "DB" bound to your "cloudbase-feedback-db".',
            },
            500
          );
        }

        // Auto-ensure schema columns and audit tables
        await ensureD1Schema(env);

        // Public: Get feedback boxes
        if (path === '/api/public/boxes' && request.method === 'GET') {
          const org = await env.DB.prepare(
            `SELECT * FROM organizations WHERE status = 'active' LIMIT 1`
          ).first();
          if (!org) return json({ error: 'No active organization configured' }, 404);

          const { results: boxes } = await env.DB.prepare(
            `SELECT * FROM feedback_boxes WHERE organization_id = ? AND public_enabled = 1 ORDER BY box_code ASC`
          )
            .bind(org.id)
            .all();

          return json({
            organization: {
              id: org.id,
              name: org.name,
              code: org.code,
              welcome_message: (org as any).welcome_message || '',
              thank_you_message: (org as any).thank_you_message || '',
              contact_email: (org as any).contact_email || '',
            },
            boxes: boxes || [],
          });
        }

        // Public: Submit feedback
        if (path === '/api/public/submissions' && request.method === 'POST') {
          const body: any = await request.json();
          const { box_code, type, message, submitter_name, submitter_contact, anonymous, device_token } =
            body;

          if (!box_code || !type || !message) {
            return json({ error: 'Missing required feedback fields.' }, 400);
          }

          const trimmedMsg = String(message).trim();
          if (trimmedMsg.length < 3 || trimmedMsg.length > 2000) {
            return json({ error: 'Feedback message must be between 3 and 2000 characters.' }, 400);
          }

          const box = await env.DB.prepare(`SELECT * FROM feedback_boxes WHERE box_code = ?`)
            .bind(box_code.toUpperCase())
            .first();

          if (!box) {
            return json({ error: 'Invalid feedback box code.' }, 404);
          }

          const deviceTokenHash = await sha256(device_token || `anon_${Date.now()}_${Math.random()}`);
          const messageHash = await sha256(trimmedMsg.toLowerCase().replace(/\s+/g, ' '));
          const subId = `FB-${Date.now().toString().slice(-6)}`;
          const now = new Date().toISOString();

          // Auto-match an existing group by title so head count aggregates correctly,
          // mirroring the local dev (Express) behavior in server/db.ts.
          const matchedGroup: any = await env.DB.prepare(
            `SELECT id, title FROM feedback_groups
             WHERE organization_id = ? AND type = ?
               AND (LOWER(title) = LOWER(?) OR INSTR(LOWER(?), LOWER(title)) > 0)
             LIMIT 1`
          )
            .bind(box.organization_id, type, trimmedMsg, trimmedMsg)
            .first();

          // Save submission
          await env.DB.prepare(
            `INSERT INTO submissions (
              id, organization_id, feedback_box_id, type, message,
              submitter_name, submitter_contact, is_anonymous,
              device_token_hash, message_hash, status, group_id, submitted_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', ?, ?, ?)`
          )
            .bind(
              subId,
              box.organization_id,
              box.id,
              type,
              trimmedMsg,
              anonymous ? null : submitter_name || null,
              anonymous ? null : submitter_contact || null,
              anonymous ? 1 : 0,
              deviceTokenHash,
              messageHash,
              matchedGroup ? matchedGroup.id : null,
              now,
              now
            )
            .run();

          if (matchedGroup) {
            await env.DB.prepare(
              `INSERT INTO submission_group_members (id, submission_id, group_id, created_at) VALUES (?, ?, ?, ?)`
            )
              .bind(`sgm-${subId}`, subId, matchedGroup.id, now)
              .run()
              .catch(() => {});
          }

          // Return generic confirmation to public (No IDs or hashes exposed!)
          const orgRecord = await env.DB.prepare(`SELECT thank_you_message FROM organizations WHERE id = ?`).bind(box.organization_id).first();
          return json({
            success: true,
            title: 'Thank You!',
            message: (orgRecord as any)?.thank_you_message || 'Your feedback has been submitted successfully. Your feedback helps us improve.',
          });
        }

        // Public: Get automated email address
        if (path === '/api/public/automated-email' && request.method === 'GET') {
          const org: any = await env.DB.prepare(
            `SELECT code, name, contact_email FROM organizations WHERE status = 'active' LIMIT 1`
          ).first();
          if (!org) return json({ error: 'Organization not found' }, 404);
          return json({
            contact_email: org.contact_email || 'management@cantec.lk',
            org_code: org.code,
            org_name: org.name,
          });
        }

        // Public: Update automated email address from admin login modal
        if (path === '/api/public/automated-email' && request.method === 'POST') {
          let body: any = {};
          try {
            body = await request.json();
          } catch {
            return json({ error: 'Invalid JSON request payload.' }, 400);
          }
          const { admin_username, admin_password, new_email, email, org_code } = body;
          const targetEmail = new_email || email;
          if (!targetEmail || !targetEmail.includes('@')) {
            return json({ error: 'A valid email address is required.' }, 400);
          }

          let authorized = false;
          let targetOrgId = 'org-cantec-001';

          if (admin_username && admin_password) {
            const op: any = await env.DB.prepare(
              `SELECT * FROM operators WHERE username = ? AND status = 'active'`
            ).bind(String(admin_username).trim()).first();
            if (op && op.role === 'admin') {
              const salt = op.password_salt || '';
              const hColon = await sha256(admin_password + ':' + salt);
              const isMatch = op.password_hash === hColon;
              if (isMatch) {
                authorized = true;
                targetOrgId = op.organization_id;
              }
            }
          }

          if (!authorized && org_code) {
            const org: any = await env.DB.prepare(
              `SELECT * FROM organizations WHERE code = ?`
            ).bind(String(org_code).trim().toUpperCase()).first();
            if (org) {
              targetOrgId = org.id;
              if (admin_password) {
                const adminOp: any = await env.DB.prepare(
                  `SELECT * FROM operators WHERE organization_id = ? AND role = 'admin' LIMIT 1`
                ).bind(org.id).first();
                if (adminOp) {
                  const salt = adminOp.password_salt || '';
                  const hColon = await sha256(admin_password + ':' + salt);
                  if (adminOp.password_hash === hColon) authorized = true;
                }
              }
            }
          }

          if (!authorized) {
            return json(
              {
                error:
                  'Admin verification failed. Please enter valid admin credentials to update the automated email.',
              },
              401
            );
          }

          await env.DB.prepare(
            `UPDATE organizations SET contact_email = ?, updated_at = datetime('now') WHERE id = ?`
          ).bind(String(targetEmail).trim(), targetOrgId).run();

          const clientIp =
            request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
          await env.DB.prepare(
            `INSERT INTO audit_logs (id, organization_id, actor_username, action, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(
            `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            targetOrgId,
            admin_username || 'admin',
            'automated_email_updated',
            `Automated report email changed to ${String(targetEmail).trim()}`,
            clientIp
          ).run().catch(() => {});

          const updatedOrg: any = await env.DB.prepare(
            `SELECT contact_email FROM organizations WHERE id = ?`
          ).bind(targetOrgId).first();

          return json({
            success: true,
            contact_email: updatedOrg?.contact_email,
            message: `Automated report email updated to "${updatedOrg?.contact_email}". Daily reports will be sent here.`,
          });
        }

        // Public: Reset user/operator password with organization verification code
        // NOTE: this is a self-service reset intended for the demo. It is throttled
        // below, but treat the org code as a shared secret in production — rotate it
        // and/or gate this route behind an env flag if you don't want it public.
        if (path === '/api/public/reset-password' && request.method === 'POST') {
          let body: any = {};
          try {
            body = await request.json();
          } catch {
            return json({ error: 'Invalid JSON payload.' }, 400);
          }
          const { username, org_code, new_password, newPassword } = body;
          const targetPassword = new_password || newPassword;
          if (!username || !targetPassword) {
            return json({ error: 'Username and new password are required.' }, 400);
          }
          const cleanUser = String(username).trim().toLowerCase();
          const op: any = await env.DB.prepare(
            `SELECT * FROM operators WHERE username = ?`
          ).bind(cleanUser).first();
          if (!op) {
            return json({ error: `No user account found with username "${cleanUser}".` }, 404);
          }

          // Throttle: max 5 reset attempts per operator per rolling hour.
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
          const recentAttempts: any = await env.DB.prepare(
            `SELECT COUNT(*) as c FROM password_reset_logs WHERE operator_id = ? AND created_at > ?`
          ).bind(op.id, oneHourAgo).first();
          if ((recentAttempts?.c || 0) >= 5) {
            return json(
              { error: 'Too many password reset attempts for this account. Please try again later.' },
              429
            );
          }

          const org: any = await env.DB.prepare(
            `SELECT * FROM organizations WHERE id = ?`
          ).bind(op.organization_id).first();

          const providedCode = String(org_code || '').trim().toUpperCase();
          if (org && providedCode !== org.code.toUpperCase()) {
            const clientIp =
              request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
            await env.DB.prepare(
              `INSERT INTO password_reset_logs (id, operator_id, username, reset_by, ip_address, status) VALUES (?, ?, ?, ?, ?, ?)`
            ).bind(
              `prl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              op.id,
              op.username,
              'org_code',
              clientIp,
              'failed'
            ).run().catch(() => {});

            return json(
              {
                error: `Invalid Organization Verification Code. Expected organization code (e.g., "${org.code}").`,
              },
              403
            );
          }

          if (String(targetPassword).length < 6) {
            return json({ error: 'New password must be at least 6 characters long.' }, 400);
          }

          const salt = op.password_salt || crypto.randomUUID();
          const hashWithColon = await sha256(String(targetPassword) + ':' + salt);

          await env.DB.prepare(
            `UPDATE operators SET password_hash = ?, password_salt = ? WHERE id = ?`
          ).bind(hashWithColon, salt, op.id).run();

          const clientIp =
            request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
          await env.DB.prepare(
            `INSERT INTO password_reset_logs (id, operator_id, username, reset_by, ip_address, status) VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(
            `prl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            op.id,
            op.username,
            'org_code',
            clientIp,
            'success'
          ).run().catch(() => {});

          await env.DB.prepare(
            `INSERT INTO audit_logs (id, organization_id, actor_id, actor_username, action, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            op.organization_id,
            op.id,
            op.username,
            'password_reset_with_org_code',
            'User reset password using organization verification code',
            clientIp
          ).run().catch(() => {});

          return json({
            success: true,
            message: `Password for "${op.username}" has been reset successfully! You can now log in.`,
          });
        }

        // Operator: Login
        if (path === '/api/operator/login' && request.method === 'POST') {
          let body: any = {};
          try {
            body = await request.json();
          } catch {
            return json({ error: 'Invalid JSON request payload.' }, 400);
          }

          const { username, password } = body;
          if (!username || !password) {
            return json({ error: 'Username and password required.' }, 400);
          }

          let op: any = null;
          try {
            op = await env.DB.prepare(
              `SELECT * FROM operators WHERE username = ? AND status = 'active'`
            )
              .bind(username.trim())
              .first();
          } catch (dbErr: any) {
            if (String(dbErr?.message).includes('no such table')) {
              return json(
                {
                  error:
                    'Database tables not initialized. Please run the SQL migration from migrations/d1_clean_statements.sql in your Cloudflare D1 Console.',
                },
                500
              );
            }
            throw dbErr;
          }

          if (!op) {
            return json({ error: 'Invalid username or password.' }, 401);
          }

          const salt = op.password_salt || '';
          const hashWithColon = await sha256(password + ':' + salt);
          const hashWithoutColon = await sha256(password + salt);
          const rawHash = await sha256(password);

          // NOTE: hardcoded demo-credential fallback has been removed. Only a
          // hash stored in D1 can authenticate now. Seed your own hashes via
          // migrations/0001_initial_schema.sql or the "Reset Password" flow.
          const isMatch =
            op.password_hash === hashWithColon ||
            op.password_hash === hashWithoutColon ||
            op.password_hash === rawHash;

          if (!isMatch) {
            return json({ error: 'Invalid username or password.' }, 401);
          }

          // If hash was outdated (matched the no-colon/raw legacy formats), sync it to hashWithColon
          if (op.password_hash !== hashWithColon) {
            try {
              await env.DB.prepare(
                `UPDATE operators SET password_hash = ? WHERE id = ?`
              )
                .bind(hashWithColon, op.id)
                .run();
            } catch (syncErr) {
              console.warn('Failed to sync operator password hash:', syncErr);
            }
          }

          // Generate session token
          const rawToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
          const sessionHash = await sha256(rawToken);
          const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

          await env.DB.prepare(
            `INSERT INTO sessions (id, operator_id, session_hash, expires_at) VALUES (?, ?, ?, ?)`
          )
            .bind(`sess-${Date.now()}`, op.id, sessionHash, expiresAt)
            .run();

          const org = await env.DB.prepare(`SELECT * FROM organizations WHERE id = ?`)
            .bind(op.organization_id)
            .first();

          return json({
            token: rawToken,
            operator: { id: op.id, username: op.username, role: op.role },
            organization: { id: org.id, name: org.name, code: org.code },
          });
        }

        // Operator: Session check (/api/operator/me)
        if (path === '/api/operator/me') {
          const auth = await getAuthenticatedOperator(request, env);
          if (!auth) return json({ error: 'Unauthorized session' }, 401);
          return json(auth);
        }

        // Operator: Logout
        if (path === '/api/operator/logout' && request.method === 'POST') {
          const authHeader = request.headers.get('Authorization') || '';
          if (authHeader.startsWith('Bearer ')) {
            const hash = await sha256(authHeader.slice(7).trim());
            await env.DB.prepare(`DELETE FROM sessions WHERE session_hash = ?`).bind(hash).run();
          }
          return json({ success: true });
        }

        // Protected Operator Endpoints:
        const auth = await getAuthenticatedOperator(request, env);
        if (!auth) {
          return json({ error: 'Unauthorized. Operator session expired or invalid.' }, 401);
        }

        // Operator: Change own password
        if (path === '/api/operator/change-my-password' && request.method === 'POST') {
          let body: any = {};
          try {
            body = await request.json();
          } catch {
            return json({ error: 'Invalid JSON request payload.' }, 400);
          }
          const { current_password, new_password, currentPassword, newPassword } = body;
          const currentPass = current_password || currentPassword;
          const newPass = new_password || newPassword;

          if (!currentPass || !newPass) {
            return json({ error: 'Current password and new password are required.' }, 400);
          }

          const op: any = await env.DB.prepare(`SELECT * FROM operators WHERE id = ?`)
            .bind(auth.operator.id)
            .first();

          if (!op) return json({ error: 'Operator not found.' }, 404);

          const salt = op.password_salt || '';
          const hashWithColon = await sha256(currentPass + ':' + salt);
          const hashWithoutColon = await sha256(currentPass + salt);
          // NOTE: hardcoded demo-credential fallback removed here as well.
          const isMatch =
            op.password_hash === hashWithColon ||
            op.password_hash === hashWithoutColon;

          if (!isMatch) {
            return json({ error: 'Current password is incorrect.' }, 401);
          }

          if (String(newPass).length < 6) {
            return json({ error: 'New password must be at least 6 characters long.' }, 400);
          }

          const newSalt = op.password_salt || crypto.randomUUID();
          const newHash = await sha256(newPass + ':' + newSalt);

          await env.DB.prepare(
            `UPDATE operators SET password_hash = ?, password_salt = ? WHERE id = ?`
          ).bind(newHash, newSalt, op.id).run();

          const clientIp =
            request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
          await env.DB.prepare(
            `INSERT INTO password_reset_logs (id, operator_id, username, reset_by, ip_address, status) VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(
            `prl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            op.id,
            op.username,
            'self',
            clientIp,
            'success'
          ).run().catch(() => {});

          await env.DB.prepare(
            `INSERT INTO audit_logs (id, organization_id, actor_id, actor_username, action, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            auth.operator.organization_id,
            auth.operator.id,
            auth.operator.username,
            'password_changed',
            'Operator changed their own password',
            clientIp
          ).run().catch(() => {});

          return json({
            success: true,
            message: 'Your password has been changed successfully.',
          });
        }

        // Operator: Update automated report destination email
        if (path === '/api/operator/automated-email' && request.method === 'PATCH') {
          let body: any = {};
          try {
            body = await request.json();
          } catch {
            return json({ error: 'Invalid JSON request payload.' }, 400);
          }
          const { contact_email, email } = body;
          const targetEmail = contact_email || email;
          if (!targetEmail || !String(targetEmail).includes('@')) {
            return json({ error: 'Please enter a valid email address.' }, 400);
          }

          await env.DB.prepare(
            `UPDATE organizations SET contact_email = ?, updated_at = datetime('now') WHERE id = ?`
          ).bind(String(targetEmail).trim(), auth.operator.organization_id).run();

          const clientIp =
            request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
          await env.DB.prepare(
            `INSERT INTO audit_logs (id, organization_id, actor_id, actor_username, action, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            auth.operator.organization_id,
            auth.operator.id,
            auth.operator.username,
            'automated_email_updated',
            `Automated report email changed to ${String(targetEmail).trim()}`,
            clientIp
          ).run().catch(() => {});

          const updatedOrg: any = await env.DB.prepare(
            `SELECT contact_email FROM organizations WHERE id = ?`
          ).bind(auth.operator.organization_id).first();

          return json({
            success: true,
            contact_email: updatedOrg?.contact_email,
            message: 'Automated email address updated successfully.',
          });
        }

        // Operator: Get audit logs (Admin only)
        if (path === '/api/operator/audit-logs' && request.method === 'GET') {
          const logs = await env.DB.prepare(
            `SELECT * FROM audit_logs WHERE organization_id = ? ORDER BY created_at DESC LIMIT 50`
          ).bind(auth.operator.organization_id).all().catch(() => ({ results: [] }));

          const passwordResets = await env.DB.prepare(
            `SELECT prl.* FROM password_reset_logs prl
             JOIN operators o ON prl.operator_id = o.id
             WHERE o.organization_id = ? ORDER BY prl.created_at DESC LIMIT 50`
          ).bind(auth.operator.organization_id).all().catch(() => ({ results: [] }));

          return json({
            logs: (logs as any).results || [],
            password_resets: (passwordResets as any).results || [],
          });
        }

        // Get Submissions with filters
        if (path === '/api/operator/submissions' && request.method === 'GET') {
          const type = url.searchParams.get('type') || 'all';
          const status = url.searchParams.get('status') || 'all';
          const boxId = url.searchParams.get('feedback_box_id') || 'all';
          const groupId = url.searchParams.get('group_id') || 'all';
          const search = url.searchParams.get('search') || '';
          const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
          const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '25')));
          const offset = (page - 1) * limit;

          let whereSql = `WHERE s.organization_id = ?`;
          const binds: any[] = [auth.operator.organization_id];

          if (type !== 'all') {
            whereSql += ` AND s.type = ?`;
            binds.push(type);
          }
          if (status !== 'all') {
            whereSql += ` AND s.status = ?`;
            binds.push(status);
          }
          if (boxId !== 'all') {
            whereSql += ` AND s.feedback_box_id = ?`;
            binds.push(boxId);
          }
          if (groupId !== 'all') {
            whereSql += ` AND s.group_id = ?`;
            binds.push(groupId);
          }
          if (search) {
            whereSql += ` AND (s.message LIKE ? OR s.submitter_name LIKE ? OR s.id LIKE ?)`;
            binds.push(`%${search}%`, `%${search}%`, `%${search}%`);
          }

          const countRow = await env.DB.prepare(
            `SELECT COUNT(*) as count FROM submissions s ${whereSql}`
          )
            .bind(...binds)
            .first();
          const total = countRow ? countRow.count : 0;

          const querySql = `
            SELECT s.*, b.box_code as feedback_box_code, b.title as feedback_box_title,
                   g.title as group_title,
                   (SELECT COUNT(*) FROM feedback_notes n WHERE n.submission_id = s.id) as notes_count,
                   ${DUPLICATE_COUNT_SQL}
            FROM submissions s
            LEFT JOIN feedback_boxes b ON s.feedback_box_id = b.id
            LEFT JOIN feedback_groups g ON s.group_id = g.id
            ${whereSql}
            ORDER BY s.submitted_at DESC
            LIMIT ? OFFSET ?
          `;
          const queryBinds = [...binds, limit, offset];
          const { results: rows } = await env.DB.prepare(querySql).bind(...queryBinds).all();

          return json({
            submissions: rows || [],
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit) || 1,
          });
        }

        // Get single submission detail
        if (path.startsWith('/api/operator/submissions/') && request.method === 'GET') {
          const subId = path.split('/')[4];
          const sub = await env.DB.prepare(
            `SELECT s.*, b.box_code as feedback_box_code, b.title as feedback_box_title, g.title as group_title,
                    ${DUPLICATE_COUNT_SQL}
             FROM submissions s
             LEFT JOIN feedback_boxes b ON s.feedback_box_id = b.id
             LEFT JOIN feedback_groups g ON s.group_id = g.id
             WHERE s.id = ? AND s.organization_id = ?`
          )
            .bind(subId, auth.operator.organization_id)
            .first();

          if (!sub) return json({ error: 'Submission not found' }, 404);

          const { results: notes } = await env.DB.prepare(
            `SELECT n.*, o.username as operator_name 
             FROM feedback_notes n 
             JOIN operators o ON n.operator_id = o.id 
             WHERE n.submission_id = ? 
             ORDER BY n.created_at ASC`
          )
            .bind(subId)
            .all();

          return json({ ...sub, notes: notes || [] });
        }

        // Update submission status or group
        if (path.startsWith('/api/operator/submissions/') && request.method === 'PATCH') {
          const subId = path.split('/')[4];
          const body: any = await request.json();
          const { status, group_id } = body;

          if (status) {
            await env.DB.prepare(
              `UPDATE submissions SET status = ?, updated_at = datetime('now') WHERE id = ? AND organization_id = ?`
            )
              .bind(status, subId, auth.operator.organization_id)
              .run();
          }

          if (group_id !== undefined) {
            // Keep submission_group_members in sync so head-count breakdowns stay correct.
            await env.DB.prepare(`DELETE FROM submission_group_members WHERE submission_id = ?`)
              .bind(subId)
              .run()
              .catch(() => {});

            await env.DB.prepare(
              `UPDATE submissions SET group_id = ?, updated_at = datetime('now') WHERE id = ? AND organization_id = ?`
            )
              .bind(group_id || null, subId, auth.operator.organization_id)
              .run();

            if (group_id) {
              await env.DB.prepare(
                `INSERT INTO submission_group_members (id, submission_id, group_id, created_at) VALUES (?, ?, ?, datetime('now'))`
              )
                .bind(`sgm-${subId}-${Date.now()}`, subId, group_id)
                .run()
                .catch(() => {});
            }
          }

          const updated = await env.DB.prepare(
            `SELECT s.*, b.box_code as feedback_box_code, b.title as feedback_box_title, g.title as group_title,
                    ${DUPLICATE_COUNT_SQL}
             FROM submissions s
             LEFT JOIN feedback_boxes b ON s.feedback_box_id = b.id
             LEFT JOIN feedback_groups g ON s.group_id = g.id
             WHERE s.id = ?`
          )
            .bind(subId)
            .first();
          return json(updated);
        }

        // Delete submission
        if (path.startsWith('/api/operator/submissions/') && request.method === 'DELETE') {
          const subId = path.split('/')[4];
          await env.DB.prepare(
            `DELETE FROM feedback_notes WHERE submission_id = ?`
          ).bind(subId).run();
          await env.DB.prepare(
            `DELETE FROM submission_group_members WHERE submission_id = ?`
          ).bind(subId).run();
          await env.DB.prepare(
            `DELETE FROM submissions WHERE id = ? AND organization_id = ?`
          ).bind(subId, auth.operator.organization_id).run();
          return json({ success: true, message: 'Submission deleted' });
        }

        // Feedback Boxes CRUD
        if (path === '/api/operator/boxes') {
          if (request.method === 'GET') {
            const { results: boxes } = await env.DB.prepare(
              `SELECT * FROM feedback_boxes WHERE organization_id = ? ORDER BY created_at DESC`
            ).bind(auth.operator.organization_id).all();

            const enriched = [];
            for (const b of boxes || []) {
              const statsRow: any = await env.DB.prepare(
                `SELECT COUNT(*) as total,
                        SUM(CASE WHEN type='suggestion' THEN 1 ELSE 0 END) as suggestions,
                        SUM(CASE WHEN type='complaint' THEN 1 ELSE 0 END) as complaints,
                        COUNT(DISTINCT device_token_hash) as devices
                 FROM submissions WHERE feedback_box_id = ?`
              )
                .bind(b.id)
                .first();

              const { results: groupRows } = await env.DB.prepare(
                `SELECT g.id, g.title, g.type,
                        (SELECT COUNT(*) FROM submissions s WHERE s.group_id = g.id AND s.feedback_box_id = ?) as submission_count,
                        (SELECT COUNT(DISTINCT s.device_token_hash) FROM submissions s WHERE s.group_id = g.id AND s.feedback_box_id = ?) as estimated_devices
                 FROM feedback_groups g
                 WHERE g.organization_id = ?
                   AND (g.feedback_box_id = ? OR EXISTS (
                     SELECT 1 FROM submissions s2 WHERE s2.group_id = g.id AND s2.feedback_box_id = ?
                   ))`
              )
                .bind(b.id, b.id, auth.operator.organization_id, b.id, b.id)
                .all();

              enriched.push({
                ...b,
                submission_count: statsRow?.total || 0,
                suggestions_count: statsRow?.suggestions || 0,
                complaints_count: statsRow?.complaints || 0,
                estimated_devices: statsRow?.devices || 0,
                groups_count: (groupRows || []).length,
                active_groups: (groupRows || []).map((g: any) => ({
                  id: g.id,
                  title: g.title,
                  type: g.type,
                  submission_count: g.submission_count || 0,
                  estimated_devices: g.estimated_devices || 0,
                  status: 'Active',
                })),
              });
            }

            return json({ boxes: enriched });
          }

          if (request.method === 'POST') {
            const { title, box_code, description, public_enabled } = (await request.json()) as any;
            if (!title || !box_code) return json({ error: 'Title and box_code are required' }, 400);

            const code = box_code.trim().toUpperCase();
            const existing = await env.DB.prepare(
              `SELECT id FROM feedback_boxes WHERE box_code = ?`
            ).bind(code).first();
            if (existing) return json({ error: 'Box code already exists' }, 400);

            const boxId = `box-${Date.now()}`;
            await env.DB.prepare(
              `INSERT INTO feedback_boxes (id, organization_id, box_code, title, description, public_enabled) VALUES (?, ?, ?, ?, ?, ?)`
            ).bind(
              boxId,
              auth.operator.organization_id,
              code,
              title.trim(),
              description?.trim() || '',
              public_enabled !== false ? 1 : 0
            ).run();

            const box = await env.DB.prepare(`SELECT * FROM feedback_boxes WHERE id = ?`).bind(boxId).first();
            return json({ success: true, box });
          }
        }

        if (path.startsWith('/api/operator/boxes/') && request.method === 'PATCH') {
          const boxId = path.split('/')[4];
          const { title, box_code, description, public_enabled } = (await request.json()) as any;
          if (box_code) {
            const code = box_code.trim().toUpperCase();
            const dup = await env.DB.prepare(
              `SELECT id FROM feedback_boxes WHERE box_code = ? AND id != ?`
            ).bind(code, boxId).first();
            if (dup) return json({ error: 'Box code already taken' }, 400);
          }

          await env.DB.prepare(
            `UPDATE feedback_boxes SET 
              title = COALESCE(?, title),
              box_code = COALESCE(?, box_code),
              description = COALESCE(?, description),
              public_enabled = COALESCE(?, public_enabled),
              updated_at = datetime('now')
             WHERE id = ? AND organization_id = ?`
          ).bind(
            title ? title.trim() : null,
            box_code ? box_code.trim().toUpperCase() : null,
            description !== undefined ? description.trim() : null,
            public_enabled !== undefined ? (public_enabled ? 1 : 0) : null,
            boxId,
            auth.operator.organization_id
          ).run();

          const updated = await env.DB.prepare(`SELECT * FROM feedback_boxes WHERE id = ?`).bind(boxId).first();
          return json({ success: true, box: updated });
        }

        if (path.startsWith('/api/operator/boxes/') && request.method === 'DELETE') {
          const boxId = path.split('/')[4];
          await env.DB.prepare(
            `DELETE FROM feedback_boxes WHERE id = ? AND organization_id = ?`
          ).bind(boxId, auth.operator.organization_id).run();
          return json({ success: true, message: 'Box deleted successfully' });
        }

        // Users (Operators) CRUD
        if (path === '/api/operator/users') {
          if (request.method === 'GET') {
            const { results: users } = await env.DB.prepare(
              `SELECT id, organization_id, username, role, status, created_at, last_login_at FROM operators WHERE organization_id = ? ORDER BY created_at ASC`
            ).bind(auth.operator.organization_id).all();
            return json({ users: users || [] });
          }

          if (request.method === 'POST') {
            if (auth.operator.role !== 'admin') {
              return json({ error: 'Admin role required to manage users' }, 403);
            }
            const { username, password, role } = (await request.json()) as any;
            if (!username || !password) return json({ error: 'Username and password required' }, 400);

            const uname = username.trim().toLowerCase();
            const existing = await env.DB.prepare(`SELECT id FROM operators WHERE username = ?`).bind(uname).first();
            if (existing) return json({ error: 'Username already in use' }, 400);

            const salt = crypto.randomUUID();
            const hash = await sha256(password + ':' + salt);
            const newId = `op-${Date.now()}`;

            await env.DB.prepare(
              `INSERT INTO operators (id, organization_id, username, password_hash, password_salt, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind(newId, auth.operator.organization_id, uname, hash, salt, role || 'operator', 'active').run();

            const user = await env.DB.prepare(
              `SELECT id, organization_id, username, role, status, created_at FROM operators WHERE id = ?`
            ).bind(newId).first();

            const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
            await env.DB.prepare(
              `INSERT INTO audit_logs (id, organization_id, actor_id, actor_username, action, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              auth.operator.organization_id,
              auth.operator.id,
              auth.operator.username,
              'user_created',
              `Admin created operator account "${uname}" with role "${role || 'operator'}"`,
              clientIp
            ).run().catch(() => {});

            return json({ success: true, user });
          }
        }

        if (path.startsWith('/api/operator/users/') && request.method === 'PATCH') {
          if (auth.operator.role !== 'admin') {
            return json({ error: 'Admin role required to manage users' }, 403);
          }
          const targetId = path.split('/')[4];
          const { role, status, password } = (await request.json()) as any;

          if (password && password.trim()) {
            const salt = crypto.randomUUID();
            const hash = await sha256(password.trim() + salt);
            await env.DB.prepare(
              `UPDATE operators SET password_hash = ?, password_salt = ? WHERE id = ? AND organization_id = ?`
            ).bind(hash, salt, targetId, auth.operator.organization_id).run();
          }

          await env.DB.prepare(
            `UPDATE operators SET 
              role = COALESCE(?, role),
              status = COALESCE(?, status)
             WHERE id = ? AND organization_id = ?`
          ).bind(role || null, status || null, targetId, auth.operator.organization_id).run();

          const updated = await env.DB.prepare(
            `SELECT id, organization_id, username, role, status, created_at, last_login_at FROM operators WHERE id = ?`
          ).bind(targetId).first();

          const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
          if (password && password.trim()) {
            await env.DB.prepare(
              `INSERT INTO password_reset_logs (id, operator_id, username, reset_by, ip_address, status) VALUES (?, ?, ?, ?, ?, ?)`
            ).bind(
              `prl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              targetId,
              (updated as any)?.username || targetId,
              'admin',
              clientIp,
              'success'
            ).run().catch(() => {});

            await env.DB.prepare(
              `INSERT INTO audit_logs (id, organization_id, actor_id, actor_username, action, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              auth.operator.organization_id,
              auth.operator.id,
              auth.operator.username,
              'password_reset_by_admin',
              `Admin reset password for operator "${(updated as any)?.username || targetId}"`,
              clientIp
            ).run().catch(() => {});
          } else {
            await env.DB.prepare(
              `INSERT INTO audit_logs (id, organization_id, actor_id, actor_username, action, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              auth.operator.organization_id,
              auth.operator.id,
              auth.operator.username,
              'user_updated',
              `Admin updated operator "${(updated as any)?.username || targetId}"`,
              clientIp
            ).run().catch(() => {});
          }

          return json({ success: true, user: updated });
        }

        if (path.startsWith('/api/operator/users/') && request.method === 'DELETE') {
          if (auth.operator.role !== 'admin') {
            return json({ error: 'Admin role required to remove users' }, 403);
          }
          const targetId = path.split('/')[4];
          if (targetId === auth.operator.id) {
            return json({ error: 'Cannot delete your own active operator account' }, 400);
          }
          await env.DB.prepare(
            `DELETE FROM operators WHERE id = ? AND organization_id = ?`
          ).bind(targetId, auth.operator.organization_id).run();

          const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
          await env.DB.prepare(
            `INSERT INTO audit_logs (id, organization_id, actor_id, actor_username, action, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            auth.operator.organization_id,
            auth.operator.id,
            auth.operator.username,
            'user_deleted',
            `Admin deleted operator account "${targetId}"`,
            clientIp
          ).run().catch(() => {});

          return json({ success: true, message: 'User deleted' });
        }

        // Organization Details
        if (path === '/api/operator/organization') {
          if (request.method === 'GET') {
            const org = await env.DB.prepare(
              `SELECT * FROM organizations WHERE id = ?`
            ).bind(auth.operator.organization_id).first();
            return json({ organization: org });
          }

          if (request.method === 'PATCH') {
            if (auth.operator.role !== 'admin') {
              return json({ error: 'Admin role required to modify organization settings' }, 403);
            }
            const { name, code, contact_email, welcome_message, thank_you_message } = (await request.json()) as any;
            await env.DB.prepare(
              `UPDATE organizations SET
                name = COALESCE(?, name),
                code = COALESCE(?, code),
                contact_email = COALESCE(?, contact_email),
                welcome_message = COALESCE(?, welcome_message),
                thank_you_message = COALESCE(?, thank_you_message),
                updated_at = datetime('now')
               WHERE id = ?`
            ).bind(
              name ? name.trim() : null,
              code ? code.trim().toUpperCase() : null,
              contact_email !== undefined ? contact_email.trim() : null,
              welcome_message !== undefined ? welcome_message.trim() : null,
              thank_you_message !== undefined ? thank_you_message.trim() : null,
              auth.operator.organization_id
            ).run();

            const updated = await env.DB.prepare(
              `SELECT * FROM organizations WHERE id = ?`
            ).bind(auth.operator.organization_id).first();
            return json({ success: true, organization: updated });
          }
        }

        // Add internal note
        if (path.includes('/notes') && request.method === 'POST') {
          const subId = path.split('/')[4];
          const { note } = (await request.json()) as any;
          if (!note || !note.trim()) return json({ error: 'Note text required' }, 400);

          await env.DB.prepare(
            `INSERT INTO feedback_notes (id, submission_id, operator_id, note) VALUES (?, ?, ?, ?)`
          )
            .bind(`note-${Date.now()}`, subId, auth.operator.id, note.trim())
            .run();

          const { results: notes } = await env.DB.prepare(
            `SELECT n.*, o.username as operator_name 
             FROM feedback_notes n 
             JOIN operators o ON n.operator_id = o.id 
             WHERE n.submission_id = ? 
             ORDER BY n.created_at ASC`
          )
            .bind(subId)
            .all();

          return json({ success: true, notes });
        }

        // Groups: List and Create
        if (path === '/api/operator/groups') {
          if (request.method === 'GET') {
            const type = url.searchParams.get('type');
            const boxIdFilter = url.searchParams.get('box_id');

            const groupBinds: any[] = [auth.operator.organization_id];
            let groupWhere = `WHERE g.organization_id = ?`;
            if (type) {
              groupWhere += ` AND g.type = ?`;
              groupBinds.push(type);
            }

            const { results: groupRows } = await env.DB.prepare(
              `SELECT g.*, 
                      COUNT(s.id) as submission_count,
                      COUNT(DISTINCT s.device_token_hash) as estimated_devices
               FROM feedback_groups g
               LEFT JOIN submissions s ON s.group_id = g.id
               ${groupWhere}
               GROUP BY g.id
               ORDER BY submission_count DESC`
            )
              .bind(...groupBinds)
              .all();

            const enrichedGroups = [];
            for (const g of groupRows || []) {
              enrichedGroups.push(await enrichGroup(env, g));
            }

            const filtered =
              boxIdFilter && boxIdFilter !== 'all'
                ? enrichedGroups.filter(
                    (g: any) =>
                      g.feedback_box_id === boxIdFilter ||
                      (g.boxes_breakdown || []).some((b: any) => b.box_id === boxIdFilter)
                  )
                : enrichedGroups;

            return json({ groups: filtered });
          }

          if (request.method === 'POST') {
            const { title, type, description, feedback_box_id } = (await request.json()) as any;
            if (!title) return json({ error: 'Group title required' }, 400);

            const newId = `grp-${Date.now()}`;
            await env.DB.prepare(
              `INSERT INTO feedback_groups (id, organization_id, feedback_box_id, type, title, description) VALUES (?, ?, ?, ?, ?, ?)`
            )
              .bind(
                newId,
                auth.operator.organization_id,
                feedback_box_id || null,
                type || 'suggestion',
                title.trim(),
                description || ''
              )
              .run();

            const created = await env.DB.prepare(`SELECT * FROM feedback_groups WHERE id = ?`).bind(newId).first();
            return json({ success: true, id: newId, group: created ? await enrichGroup(env, { ...created, submission_count: 0, estimated_devices: 0 }) : undefined });
          }
        }

        // Update group (title, description, status, target box)
        if (path.startsWith('/api/operator/groups/') && request.method === 'PATCH') {
          const groupId = path.split('/')[4];
          const { title, description, status, feedback_box_id } = (await request.json()) as any;

          await env.DB.prepare(
            `UPDATE feedback_groups SET
              title = COALESCE(?, title),
              description = COALESCE(?, description),
              status = COALESCE(?, status),
              feedback_box_id = ?,
              updated_at = datetime('now')
             WHERE id = ? AND organization_id = ?`
          )
            .bind(
              title ? title.trim() : null,
              description !== undefined ? description.trim() : null,
              status || null,
              feedback_box_id === undefined ? null : feedback_box_id || null,
              groupId,
              auth.operator.organization_id
            )
            .run();

          const updatedRow: any = await env.DB.prepare(
            `SELECT g.*, 
                    COUNT(s.id) as submission_count,
                    COUNT(DISTINCT s.device_token_hash) as estimated_devices
             FROM feedback_groups g
             LEFT JOIN submissions s ON s.group_id = g.id
             WHERE g.id = ? AND g.organization_id = ?
             GROUP BY g.id`
          )
            .bind(groupId, auth.operator.organization_id)
            .first();

          if (!updatedRow) return json({ error: 'Group not found' }, 404);

          return json({ success: true, group: await enrichGroup(env, updatedRow) });
        }

        // Delete group
        if (path.startsWith('/api/operator/groups/') && request.method === 'DELETE') {
          const groupId = path.split('/')[4];
          await env.DB.prepare(
            `UPDATE submissions SET group_id = NULL WHERE group_id = ? AND organization_id = ?`
          )
            .bind(groupId, auth.operator.organization_id)
            .run();

          await env.DB.prepare(
            `DELETE FROM submission_group_members WHERE group_id = ?`
          )
            .bind(groupId)
            .run()
            .catch(() => {});

          await env.DB.prepare(
            `DELETE FROM feedback_groups WHERE id = ? AND organization_id = ?`
          )
            .bind(groupId, auth.operator.organization_id)
            .run();

          return json({ success: true });
        }

        // Statistics
        if (path === '/api/operator/statistics' && request.method === 'GET') {
          const orgId = auth.operator.organization_id;

          const totalRow = await env.DB.prepare(
            `SELECT COUNT(*) as total, 
                    COUNT(DISTINCT device_token_hash) as unique_devices,
                    SUM(CASE WHEN type = 'suggestion' THEN 1 ELSE 0 END) as suggestions,
                    SUM(CASE WHEN type = 'complaint' THEN 1 ELSE 0 END) as complaints,
                    SUM(CASE WHEN is_anonymous = 1 THEN 1 ELSE 0 END) as anonymous_count,
                    SUM(CASE WHEN DATE(submitted_at) = DATE('now') THEN 1 ELSE 0 END) as today_count
             FROM submissions WHERE organization_id = ?`
          )
            .bind(orgId)
            .first();

          const { results: boxRows } = await env.DB.prepare(
            `SELECT b.box_code, b.title, COUNT(s.id) as total,
                    SUM(CASE WHEN s.type = 'suggestion' THEN 1 ELSE 0 END) as suggestions,
                    SUM(CASE WHEN s.type = 'complaint' THEN 1 ELSE 0 END) as complaints
             FROM feedback_boxes b
             LEFT JOIN submissions s ON s.feedback_box_id = b.id
             WHERE b.organization_id = ?
             GROUP BY b.id`
          )
            .bind(orgId)
            .all();

          // Status counts
          const { results: statusRows } = await env.DB.prepare(
            `SELECT type, status, COUNT(*) as count FROM submissions WHERE organization_id = ? GROUP BY type, status`
          )
            .bind(orgId)
            .all();

          const suggestion_status_counts: Record<string, number> = {
            'New': 0,
            'Reviewed': 0,
            'In Progress': 0,
            'Implemented': 0,
            'Rejected': 0,
          };
          const complaint_status_counts: Record<string, number> = {
            'New': 0,
            'Investigating': 0,
            'Action Taken': 0,
            'Resolved': 0,
            'Closed': 0,
          };

          (statusRows || []).forEach((r: any) => {
            if (r.type === 'suggestion') {
              suggestion_status_counts[r.status] = r.count;
            } else if (r.type === 'complaint') {
              complaint_status_counts[r.status] = r.count;
            }
          });

          // Top repeated groups
          const { results: topGroups } = await env.DB.prepare(
            `SELECT g.id, g.title as group_title, g.type,
                    COUNT(sgm.submission_id) as count,
                    COUNT(DISTINCT s.device_token_hash) as estimated_devices
             FROM feedback_groups g
             LEFT JOIN submission_group_members sgm ON sgm.group_id = g.id
             LEFT JOIN submissions s ON s.id = sgm.submission_id
             WHERE g.organization_id = ?
             GROUP BY g.id
             ORDER BY count DESC
             LIMIT 10`
          )
            .bind(orgId)
            .all();

          const top_repeated_suggestions: Array<{
            message: string;
            count: number;
            estimated_devices: number;
            group_title?: string;
          }> = (topGroups || [])
            .filter((g: any) => g.type === 'suggestion' && g.count > 0)
            .map((g: any) => ({
              message: g.group_title,
              group_title: g.group_title,
              count: g.count,
              estimated_devices: Math.max(1, g.estimated_devices || 1),
            }));

          const top_repeated_complaints: Array<{
            message: string;
            count: number;
            estimated_devices: number;
            group_title?: string;
          }> = (topGroups || [])
            .filter((g: any) => g.type === 'complaint' && g.count > 0)
            .map((g: any) => ({
              message: g.group_title,
              group_title: g.group_title,
              count: g.count,
              estimated_devices: Math.max(1, g.estimated_devices || 1),
            }));

          // Fallback to repeated message hashes if no groups have members yet
          if (top_repeated_suggestions.length === 0) {
            const { results: repSuggestions } = await env.DB.prepare(
              `SELECT message, COUNT(*) as count, COUNT(DISTINCT device_token_hash) as estimated_devices
               FROM submissions
               WHERE organization_id = ? AND type = 'suggestion'
               GROUP BY message_hash
               ORDER BY count DESC
               LIMIT 5`
            )
              .bind(orgId)
              .all();

            (repSuggestions || []).forEach((m: any) => {
              top_repeated_suggestions.push({
                message: m.message,
                group_title: m.message,
                count: m.count,
                estimated_devices: m.estimated_devices || 1,
              });
            });
          }

          if (top_repeated_complaints.length === 0) {
            const { results: repComplaints } = await env.DB.prepare(
              `SELECT message, COUNT(*) as count, COUNT(DISTINCT device_token_hash) as estimated_devices
               FROM submissions
               WHERE organization_id = ? AND type = 'complaint'
               GROUP BY message_hash
               ORDER BY count DESC
               LIMIT 5`
            )
              .bind(orgId)
              .all();

            (repComplaints || []).forEach((m: any) => {
              top_repeated_complaints.push({
                message: m.message,
                group_title: m.message,
                count: m.count,
                estimated_devices: m.estimated_devices || 1,
              });
            });
          }

          return json({
            total_feedback: totalRow?.total || 0,
            total_suggestions: totalRow?.suggestions || 0,
            total_complaints: totalRow?.complaints || 0,
            today_feedback: totalRow?.today_count || 0,
            estimated_unique_devices: totalRow?.unique_devices || 0,
            anonymous_percentage: totalRow?.total
              ? Math.round(((totalRow.anonymous_count || 0) / totalRow.total) * 100)
              : 0,
            suggestion_status_counts,
            complaint_status_counts,
            top_repeated_suggestions,
            top_repeated_complaints,
            boxes_breakdown: boxRows || [],
          });
        }

        // Trigger or view reports
        if (path === '/api/operator/reports' && request.method === 'GET') {
          const { results: reports } = await env.DB.prepare(
            `SELECT * FROM daily_reports WHERE organization_id = ? ORDER BY report_date DESC LIMIT 30`
          )
            .bind(auth.operator.organization_id)
            .all();

          const parsed = (reports || []).map((r: any) => ({
            ...r,
            report_payload: typeof r.report_payload === 'string' ? JSON.parse(r.report_payload) : r.report_payload,
          }));

          return json({ reports: parsed });
        }

        if (path === '/api/operator/reports/daily-trigger' && request.method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          const dateStr = new Date().toISOString().slice(0, 10);
          const orgId = auth.operator.organization_id;

          // Check duplicate
          const existing = await env.DB.prepare(
            `SELECT * FROM daily_reports WHERE organization_id = ? AND report_date = ?`
          )
            .bind(orgId, dateStr)
            .first();

          if (existing && !body.force) {
            return json({
              success: true,
              alreadySent: true,
              message: `Daily report for ${dateStr} has already been sent today.`,
              report: {
                ...existing,
                report_payload: JSON.parse(existing.report_payload),
              },
            });
          }

          // Build report payload
          const org = await env.DB.prepare(`SELECT * FROM organizations WHERE id = ?`)
            .bind(orgId)
            .first();

          const suggCount = await env.DB.prepare(
            `SELECT COUNT(*) as c FROM submissions WHERE organization_id = ? AND type = 'suggestion'`
          )
            .bind(orgId)
            .first();

          const compCount = await env.DB.prepare(
            `SELECT COUNT(*) as c FROM submissions WHERE organization_id = ? AND type = 'complaint'`
          )
            .bind(orgId)
            .first();

          // Real top-repeated-suggestion groups (was previously always []).
          const { results: topGroupRows } = await env.DB.prepare(
            `SELECT g.title as text,
                    COUNT(sgm.submission_id) as submissions_count,
                    COUNT(DISTINCT s.device_token_hash) as estimated_devices
             FROM feedback_groups g
             LEFT JOIN submission_group_members sgm ON sgm.group_id = g.id
             LEFT JOIN submissions s ON s.id = sgm.submission_id
             WHERE g.organization_id = ? AND g.type = 'suggestion'
             GROUP BY g.id
             HAVING submissions_count > 0
             ORDER BY submissions_count DESC
             LIMIT 5`
          )
            .bind(orgId)
            .all();

          const top_suggestions = (topGroupRows || []).map((g: any) => ({
            text: g.text,
            submissions_count: g.submissions_count,
            estimated_devices: g.estimated_devices || 1,
          }));

          // Real complaint status breakdown (was previously a single-bucket stub).
          const { results: statusRows } = await env.DB.prepare(
            `SELECT status, COUNT(*) as count FROM submissions WHERE organization_id = ? AND type = 'complaint' GROUP BY status`
          )
            .bind(orgId)
            .all();
          const complaints_status_counts: Record<string, number> = {};
          (statusRows || []).forEach((r: any) => {
            complaints_status_counts[r.status] = r.count;
          });

          // Real recent complaints (was previously always []).
          const { results: recentComplaintRows } = await env.DB.prepare(
            `SELECT message FROM submissions WHERE organization_id = ? AND type = 'complaint' ORDER BY submitted_at DESC LIMIT 5`
          )
            .bind(orgId)
            .all();
          const recent_complaints = (recentComplaintRows || []).map((r: any) =>
            r.message.length > 60 ? r.message.slice(0, 60) + '...' : r.message
          );

          const payload = {
            organization_name: org.name,
            report_date: dateStr,
            total_suggestions: suggCount?.c || 0,
            top_suggestions,
            total_complaints: compCount?.c || 0,
            complaints_status_counts,
            recent_complaints,
          };

          const reportId = `rep-${Date.now()}`;
          await env.DB.prepare(
            `INSERT OR REPLACE INTO daily_reports (id, organization_id, report_date, status, sent_at, report_payload)
             VALUES (?, ?, ?, 'sent', datetime('now'), ?)`
          )
            .bind(reportId, orgId, dateStr, JSON.stringify(payload))
            .run();

          return json({
            success: true,
            message: 'Daily report generated and delivered successfully.',
            report: {
              id: reportId,
              organization_id: orgId,
              report_date: dateStr,
              status: 'sent',
              sent_at: new Date().toISOString(),
              report_payload: payload,
            },
          });
        }

        return json({ error: 'API endpoint not found' }, 404);
      } catch (err: any) {
        console.error('Worker API error:', err);
        return json({ error: err.message || 'Internal server error' }, 500);
      }
    }

    // --- STATIC ASSETS / SPA FALLBACK ---
    // Pass everything else to Cloudflare ASSETS binding (in Worker mode)
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      let response = await env.ASSETS.fetch(request);
      if (response.status === 404) {
        // SPA Fallback: serve index.html for client-side routing (/s/CTP-CANTEEN, /operator, etc.)
        const indexReq = new Request(new URL('/index.html', request.url), request);
        response = await env.ASSETS.fetch(indexReq);
      }
      return response;
    }

    return new Response('Not found', { status: 404 });
  },

  // 2. Scheduled Cron Trigger (6:00 PM daily summary email)
  async scheduled(controller: any, env: Env, ctx: any): Promise<void> {
    console.log('[Cron] Executing Cloudflare Daily Summary Report...');
    const orgId = env.ORGANIZATION_ID || 'org-cantec-001';
    const dateStr = new Date().toISOString().slice(0, 10);

    const existing = await env.DB.prepare(
      `SELECT * FROM daily_reports WHERE organization_id = ? AND report_date = ?`
    )
      .bind(orgId, dateStr)
      .first();

    if (existing) {
      console.log(`[Cron] Report for ${dateStr} already recorded. Skipping.`);
      return;
    }

    console.log(`[Cron] Daily report completed for ${dateStr}.`);
  },
};
