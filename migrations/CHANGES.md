# CloudBase Digital Feedback Box — Fix Summary

This package contains corrected replacements for **3 files** in your repo.
Everything else in your project is unchanged — just drop these in over the
existing paths and redeploy.

## Files in this package

```
worker/index.ts                         <- replaces your existing file
migrations/0001_initial_schema.sql      <- replaces your existing file
migrations/d1_clean_statements.sql      <- replaces your existing file (verified correct, rewritten for consistency)
```

## Why Groups & Head Count wasn't syncing (all fixed in worker/index.ts)

1. **`POST /api/operator/groups` dropped `feedback_box_id`.** Creating a
   group and assigning it to a specific QR box silently ignored the box —
   every group came back "Cross-Facility." Fixed: the field is now saved.

2. **`PATCH /api/operator/groups/:id` didn't exist.** The "Edit Feedback
   Group" modal (title/status/box reassignment) called an endpoint the
   Worker never defined, so it 404'd in production. Added the full route.

3. **`GET /api/operator/groups` never computed `boxes_breakdown`,
   `sample_messages`, or `feedback_box_title/code`.** The dashboard's
   "Head Count by QR Location" panel and sample-message list always
   rendered empty because the API simply didn't send that data. Added a
   helper (`enrichGroup`) that computes per-box submission/device counts
   for each group, matching what the UI expects.

4. **Submissions never carried `duplicate_count` / `estimated_devices_count`.**
   Both the list and detail submission endpoints returned raw rows with no
   duplicate/device math, so the "X submissions · Y devices" badge and the
   detail modal's "Related Feedback Head Count" box always showed the
   `|| 1` fallback (always "1 submission · 1 device"). Added a reusable SQL
   fragment that computes this by group membership (or by matching
   `message_hash` when a submission isn't grouped).

5. **Assigning/unassigning a submission's group via `PATCH
   /api/operator/submissions/:id` didn't touch `submission_group_members`.**
   That table is what the group-level breakdown queries rely on, so
   reassigning a submission's group in the UI wouldn't actually move it for
   head-count purposes. Fixed to keep that join table in sync.

6. **Public submissions never got auto-matched into an existing group.**
   The Express/local dev version does this (`server/db.ts`); the Worker
   didn't, so every new QR-code submission in production landed as its own
   ungrouped item instead of joining the matching group's head count. Added
   the same title-matching logic to `POST /api/public/submissions`.

## Why Boxes & QR Codes showed 0/0 (fixed)

`GET /api/operator/boxes` only ran `SELECT * FROM feedback_boxes` — no
`submission_count`, `estimated_devices`, `suggestions_count`,
`complaints_count`, or `active_groups`. The dashboard defaults all of these
to `0` when absent, so every box card showed "0 Submissions / 0 Devices"
even with real data behind it. Fixed: each box now gets its stats and
active-group list computed per request.

## Why the Daily Report preview was empty (fixed)

`POST /api/operator/reports/daily-trigger` built a stub payload:
`top_suggestions: []` always, and a fake single-bucket complaint status
count. Replaced with real queries for top repeated suggestion groups,
full complaint status breakdown, and the 5 most recent complaint messages —
matching the logic that already existed in `server/reports.ts` for local
dev.

## Login / security fixes

1. **Removed the hardcoded backdoor credentials** (`admin`/`password123`
   and `operator`/`cantec2026` matched unconditionally, bypassing the
   stored hash) from both the login endpoint and the "change my password"
   endpoint in `worker/index.ts`. Authentication now only ever succeeds
   against the hash actually stored in D1.

2. **Fixed a real hash mismatch in `migrations/0001_initial_schema.sql`.**
   The seeded `password_hash` values for `admin` and `operator` did not
   match `sha256(password + ':' + salt)` for the documented demo
   passwords — they matched neither the "with colon" nor "without colon"
   check the Worker performs. Login only worked before because of the
   backdoor removed in step 1. The corrected file now seeds the verified
   hashes (verified by recomputing them and diffing against
   `migrations/d1_clean_statements.sql`, which already had the right
   values).

3. **Added basic throttling to `/api/public/reset-password`.** This route
   lets anyone reset any operator's password by supplying only the
   organization code — no old password required. That's inherent to how
   the feature is designed (a self-service reset flow), so it wasn't
   removed, but it previously had *zero* rate limiting. It's now capped at
   5 attempts per operator per rolling hour, and failed attempts are
   logged the same way successful ones are.

## Action items after you deploy this

1. **Change the demo passwords.** Log in once with `admin` / `password123`
   and `operator` / `cantec2026`, then immediately use "Change Password"
   (or the admin "Reset Password" tool) to set real passwords — these
   demo credentials are printed in your own `README.md` and
   `DEPLOYMENT.md`, so anyone who finds your repo can read them.

2. **Consider changing the organization code (`CTP`)** or gating
   `/api/public/reset-password` off entirely for production, since the
   only thing standing between a stranger and a password reset is that
   4-letter code, which is shown right on your login screen's UI as a
   demo hint.

3. **Re-run migrations.** If your D1 database was created from the old
   `migrations/0001_initial_schema.sql`, its seeded operator hashes were
   wrong. Since the table uses `INSERT OR IGNORE`, simply re-running that
   file again won't fix already-existing rows. Instead run
   `migrations/d1_clean_statements.sql` (it uses `INSERT OR REPLACE` for
   the `operators` table), or just reset your operator passwords via the
   dashboard once you're able to log in.

   ```bash
   npx wrangler d1 execute cloudbase-feedback-db --remote --file=./migrations/d1_clean_statements.sql
   ```

4. **Deploy as usual:**
   ```bash
   npm install
   npm run build
   npx wrangler deploy
   ```

No frontend files needed to change — the React dashboard was already
sending/expecting the right shape of data; the Worker just wasn't
producing it.
