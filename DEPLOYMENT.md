# CloudBase Digital Feedback Box - Cloudflare Deployment Guide

This project is built to deploy seamlessly to **Cloudflare** using **Cloudflare Workers (with static assets)** and **Cloudflare D1 (Serverless SQLite Database)**.

---

## Architecture Overview

- **Frontend:** React 19 + Tailwind CSS + PWA (served via Cloudflare Assets)
- **Backend API & Cron:** Cloudflare Worker (`worker/index.ts`)
- **Database:** Cloudflare D1 Serverless Database (`migrations/0001_initial_schema.sql`)
- **Configuration:** `wrangler.toml`

---

## Prerequisites

1. A [Cloudflare Account](https://dash.cloudflare.com/)
2. [Node.js](https://nodejs.org/) installed on your machine
3. Wrangler CLI (`npx wrangler`)

---

## Step 1: Push Code to Your GitHub Repository

Initialize and push this exact codebase to your GitHub repository:

```bash
git init
git add .
git commit -m "Initial commit - CloudBase Digital Feedback Box"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

---

## Step 2: Create the Cloudflare D1 Database

In your local terminal (or via Cloudflare Dashboard):

```bash
# 1. Log in to Cloudflare with Wrangler
npx wrangler login

# 2. Create the D1 database
npx wrangler d1 create cloudbase-feedback-db
```

Wrangler will output something like this:
```toml
[[d1_databases]]
binding = "DB"
database_name = "cloudbase-feedback-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

---

## Step 3: Update `wrangler.toml` with your `database_id`

Open `wrangler.toml` and update the `database_id` field:

```toml
[[d1_databases]]
binding = "DB"
database_name = "cloudbase-feedback-db"
database_id = "PASTE_YOUR_DATABASE_ID_HERE"
```

---

## Step 4: Run the Database Migrations (Schema & Seed Data)

### Option A: Fresh Database Setup
Execute the initial SQL migration to create all 11 tables (`organizations`, `feedback_boxes`, `operators`, `submissions`, `feedback_groups`, `submission_group_members`, `feedback_notes`, `sessions`, `daily_reports`, `password_reset_logs`, `audit_logs`) with all configuration fields (`contact_email`, `welcome_message`, `thank_you_message`, `recipient_email`) and default seed data:

```bash
# Apply fresh schema to your Cloudflare D1 database:
npx wrangler d1 execute cloudbase-feedback-db --remote --file=./migrations/0001_initial_schema.sql
```

### Option B: Upgrading an Existing D1 Database
If you already initialized your database earlier and need to add the new tables (`password_reset_logs`, `audit_logs`) and automated report email columns without losing existing records:

```bash
# Apply incremental migration 0002:
npx wrangler d1 execute cloudbase-feedback-db --remote --file=./migrations/0002_add_email_password_audit.sql
```

You can verify that the tables and columns were created:
```bash
npx wrangler d1 execute cloudbase-feedback-db --remote --command="SELECT name, contact_email FROM organizations;"
npx wrangler d1 execute cloudbase-feedback-db --remote --command="SELECT name FROM sqlite_master WHERE type='table';"
```

---

## Step 5: Build and Deploy

Build the React frontend and deploy the Worker with static assets:

```bash
# 1. Install dependencies
npm install

# 2. Build the frontend production bundle (Vite outputs to /dist)
npm run build

# 3. Deploy everything to Cloudflare!
npx wrangler deploy
```

Wrangler will upload your frontend assets and worker, outputting your live production URL:
```
Published cloudbase-digital-feedback (x.xx sec)
  https://cloudbase-digital-feedback.YOUR_SUBDOMAIN.workers.dev
```

---

## Step 6 (Alternative): Deploy via Cloudflare Dashboard + GitHub

If you prefer connecting your GitHub repository directly in the Cloudflare Dashboard:

1. Go to **Cloudflare Dashboard** > **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
2. Select your repository.
3. Configure the Build settings:
   - **Framework preset:** `Vite`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Under **Settings > Functions > D1 Database Bindings**:
   - Variable name: `DB`
   - D1 Database: Select `cloudbase-feedback-db`
5. Click **Save and Deploy**.

---

## Step 7: Initial Login Credentials

Once deployed, access your live domain:
- **Public Feedback URL:** `https://your-domain.workers.dev/` or `https://your-domain.workers.dev/s/CTP-CANTEEN`
- **Operator Dashboard URL:** `https://your-domain.workers.dev/operator`

**Default Pre-configured Accounts:**
| Role | Username | Password |
|---|---|---|
| **Admin** | `admin` | `password123` |
| **Operator** | `operator` | `cantec2026` |

*(You can change these passwords or create new operators directly via the database or dashboard).*

---

## Step 8: Cron Trigger for Daily Reports

The scheduled cron trigger is already defined in `wrangler.toml`:
```toml
[triggers]
crons = ["0 18 * * *"] # Every day at 6:00 PM UTC
```
Cloudflare will automatically run the daily summary task every day at 18:00 UTC. To test it manually anytime, use the **"Run Daily Cron Now"** button in the **Daily Email Reports** tab inside the Operator Dashboard.
