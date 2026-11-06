# CareerGroove v2 — Design Specification

**Date:** 2026-11-05
**Status:** Approved
**Author:** Jeremy Guill / CareerGroove

## 1. Goal

Build a greenfield, personal, mobile-first career workflow app that replaces the
current CareerGroove UI without modifying the existing app or database. The new
app lives in `v2/`, ships as a **single Docker container** (app + Postgres), and
takes over port 3000 only after it is built, verified, and pushed.

The app must make three things obvious at all times:

1. What needs attention now.
2. What stage every application is in.
3. Where to go to do the next thing.

## 2. Non-goals

- No music player or audio features of any kind.
- No native iOS app and no mobile-only API surface. The native app is retired.
- No Stripe billing, tiers, paywalls, or subscription management at launch.
- No brand studio or analytics at launch.
- No IMAP inbox sync. Email means SMTP send plus an email log.
- No migration of the 335 old applications, documents, or email data.
- No Tailwind, no separate REST API for the web UI, no Redis.

## 3. Users and authentication

- Two accounts survive: `rbtm2006@me.com` (admin) and `rbtm2006@icloud.com`.
- Auth is provided by better-auth with email/password and optional passkeys.
- Existing bcrypt password hashes are migrated, so both users keep their
  current passwords.
- Sessions are not migrated; users sign in again after cutover.
- OAuth and passkeys are optional. If a passkey cannot be migrated, the user can
  register a new one after signing in.
- Admin-only surfaces are gated by `user.is_admin`.
- Bootstrap values come from env: `DATABASE_URL`, `AUTH_SECRET`,
  `ENCRYPTION_KEY`, and the initial admin email. All other application
  configuration (AI providers, models, API keys, search keys) lives in the
  database and is edited through the Admin UI.

## 4. Information architecture

Top-level destinations, always visible:

1. **Home** — progress snapshot and follow-ups due.
2. **Applications** — the single canonical pipeline.
3. **Profile** — contact, work history, skills, credentials, resume base.
4. **Interview** — interview cards and prep.

Secondary surfaces:

- **Tools menu:** Network, Research, Admin.
- **Account menu:** sign out, settings.
- **Contextual:** Documents library (from Profile and application detail),
  follow-ups and email log (from Home and Applications), import flows.

## 5. Stage machine

One enum on `applications`:

`lead → preparing → applied → interviewing → decision`

- `decision` carries an outcome: `offer`, `rejected`, `withdrawn`, `accepted`,
  `declined`.
- Follow-up is a next-action type, never a stage.
- Backward moves are allowed; every move writes an `application_events` row.
- `decision` may be reopened to any active stage.
- Views never compute a separate status. Everything reads the same row.

## 6. Next actions

Each application has exactly one current next action:

- `type`: `research`, `decide_fit`, `tailor_documents`, `apply`, `follow_up`,
  `prep_interview`, `review_offer`, `close`
- `due_at`: timestamp
- `note`: optional text

Rules:

- Entering a stage seeds a default action and due date:
  - `lead` → `decide_fit` in 2 days
  - `preparing` → `tailor_documents` in 3 days
  - `applied` → `follow_up` in 7 days
  - `interviewing` → `prep_interview` on the interview date (or 2 days)
  - `decision` → `review_offer` in 2 days
- The user may override type, date, and note.
- Completing an action writes a timeline event and prompts for the next action.
- Home lists actions where `due_at <= now()` plus a short upcoming window.

## 7. Data model

Drizzle schema in `v2/src/lib/server/db/schema.ts`. All IDs are UUIDs except
better-auth IDs, which are text UUID strings.

### better-auth tables

- `user` — id, name, email, email_verified, image, is_admin, created_at,
  updated_at
- `session` — id, expires_at, token, created_at, updated_at, ip_address,
  user_agent, user_id
- `account` — id, account_id, provider_id, user_id, access_token, refresh_token,
  id_token, access_token_expires_at, refresh_token_expires_at, scope, password,
  created_at, updated_at
- `verification` — id, identifier, value, expires_at, created_at, updated_at
- `passkey` — better-auth passkey plugin table (optional at launch)

### Career data (seeded from old DB)

- `profiles` — user_id, name, phone, linkedin, github, portfolio, twitter,
  website, desired_titles, work_modes, salary_target, location_preference,
  industries, updated_at
- `jobs` — id, user_id, title, company, location, started_on, ended_on,
  description, skills, highlights, created_at, updated_at
- `residences` — id, user_id, label, street, city, region, country, postal_code,
  started_on, ended_on, notes
- `credentials` — id, user_id, kind, name, issuer, issued_on, expires_on, url,
  notes
- `skills` — id, user_id, name, category, proficiency, notes
- `job_skills` — job_id, skill_id

### Workflow data

- `applications` — id, user_id, company, title, location, work_mode,
  salary_min, salary_max, salary_currency, source_url, job_description,
  stage, outcome, next_action_type, next_action_due_at, next_action_note,
  fit_summary, created_at, updated_at, archived_at
- `application_events` — id, user_id, application_id, event_type, title, body,
  occurred_at, created_at
- `contacts` — id, user_id, name, email, phone, company, role, notes,
  created_at, updated_at
- `application_contacts` — application_id, contact_id, relationship, notes
- `documents` — id, user_id, application_id, kind, title, body_markdown,
  file_path, created_at, updated_at
- `interviews` — id, user_id, application_id, round, scheduled_at, location,
  meeting_url, interviewer_name, interviewer_email, prep_notes, status,
  created_at, updated_at
- `research_notes` — id, user_id, application_id, company, title, body,
  source_url, created_at, updated_at
- `follow_ups` — id, user_id, application_id, contact_id, due_at, status,
  subject, body, sent_at, created_at
- `email_log` — id, user_id, application_id, to_email, subject, body,
  provider, status, error, sent_at, created_at
- `app_settings` — key, value_encrypted, updated_at

## 8. Screens

### Home

- Greeting and date.
- Progress snapshot: counts per stage, active applications, interviews this
  week, actions due.
- "Needs attention" list of due/overdue next actions with complete, snooze, and
  open actions.
- Upcoming interview cards.
- Quick capture: paste URL/JD, paste job email, start research.
- Empty state leads directly to add-first-lead.

### Applications

- 5-stage board; mobile uses horizontal stage tabs and a vertical list.
- Toggle board/list; search; filters (stage, needs attention).
- Add lead: URL/JD or job email → parse preview → confirm → create `lead` and
  seed `decide_fit`.
- Detail page: header (company, title, stage, next action) and sections:
  Overview (details, JD, fit), Documents, Timeline, Interviews, People,
  Research, Notes.
- Stage change modal; `decision` requires an outcome.
- Next-action editor and complete flow.

### Profile

- Contact and basics.
- Work history: guided interview-style entry (one question at a time, AI assists
  with bullets and skills) plus manual entry.
- Residences, credentials, skills.
- Resume base and link to Documents.
- Fit preferences.

### Interview

- Dashboard of interview cards: company, role, date/time, location/link,
  interviewer.
- Detail: who/what/when/where, prep notes, research, mock questions, mock
  interview, linked application.
- Add/edit from dashboard or application detail.

### Documents

- Library of base resume, tailored variants, and cover letters.
- Generate from an application using Profile + JD.
- Preview Markdown, download PDF, link to application.

### Tools

- Network: contacts CRUD, link contacts to applications, outreach notes.
- Research: global company/role research; attach notes to applications.
- Admin: AI provider/model/key configuration, search config, test connection.

### Auth

- Sign in, sign out. Email/password first; passkeys optional.

## 9. Design system

Reference: `https://www.functionalwebsites.com`.

Tokens:

- Paper `#f5efe0`, ink `#10100d`, panel `#ebe2ce`, panel-strong `#dfd2b8`,
  steel `#29333a`, rust `#b9482e`, denim `#244d67`, gold `#e2ad30`,
  green `#7cff6b`, muted `#625d50`.
- 3px borders, 4px radius, hard offset shadows (`4px 4px 0` and `8px 8px 0`).
- JetBrains Mono for headings, labels, buttons, and data.
- System sans for long body copy and job descriptions.
- Uppercase micro-labels with letter spacing.
- Mobile-first; 390px is the primary design width.

## 10. Architecture

- **Location:** `v2/` inside the existing repo. Old code is untouched.
- **Framework:** SvelteKit + Svelte 5, TypeScript, Vite.
- **Runtime/package manager:** Bun.
- **Database:** PostgreSQL 17 inside the same container.
- **ORM:** Drizzle ORM with `pg`.
- **Auth:** better-auth with Drizzle adapter; bcrypt-compatible password
  verification.
- **UI:** Svelte scoped CSS plus global design tokens; no Tailwind.
- **Server model:** SvelteKit load functions and form actions; progressive
  enhancement; minimal client JS.
- **Jobs:** Postgres-backed queue using `FOR UPDATE SKIP LOCKED`. No Redis.
- **Email:** Nodemailer SMTP.
- **PDF:** pdf-lib with a simple structured layout.
- **AI:** direct provider calls:
  - OpenAI-compatible endpoint (OpenAI, Google, Ollama)
  - Anthropic Messages API
  - Config loaded from `app_settings`, keys encrypted with AES-256-GCM.
- **Search/research:** fetch page text + optional search API key from admin
  settings; AI summarizes.

## 11. Configuration

Environment (bootstrap only):

- `DATABASE_URL`
- `AUTH_SECRET`
- `ENCRYPTION_KEY`
- `BOOTSTRAP_ADMIN_EMAIL`
- `PORT` (default 3000)
- `HOST` (default 0.0.0.0)

Database-managed (Admin UI):

- AI provider, model, API key, base URL
- Search API key / engine ID
- SMTP host, port, user, password, sender name/email
- Default AI tasks (research, documents, interview)

Secrets in `app_settings` are encrypted with AES-256-GCM using
`ENCRYPTION_KEY`. Losing that key means re-entering the secrets.

## 12. Migration and seeding

- Source backup: `backups/pre-v2-rewrite-20261105_220251.dump`.
- Export only:
  - users `rbtm2006@me.com` and `rbtm2006@icloud.com`
  - their `preferences`
  - their `jobs`, `residences`, `credentials`, `skills`, `job_skills`
- Seed file: `v2/seed/seed.json` (contains bcrypt hashes; not committed with
  real data? It is local-only and gitignored).
- Seed is idempotent: inserts only if the user does not exist.
- No applications, documents, emails, or other users are imported.
- Old database and volume are never modified.

## 13. Docker and cutover

- Single container: `v2-app`.
- Base: `oven/bun:1-alpine`; install `postgresql17`, `postgresql17-client`,
  `bash`, `tzdata`.
- Entrypoint:
  1. Initialize the Postgres data directory if empty.
  2. Start Postgres and wait for readiness.
  3. Run schema migration.
  4. Run the seed script.
  5. Start the SvelteKit server on port 3000.
- Compose: `v2/docker-compose.yml`, one service, port 3000, named volume for
  Postgres data, `env_file: .env`.
- During development, run on port 3001 to avoid touching the old app.
- Cutover:
  1. Verify v2 health on 3001.
  2. `docker stop career_groove`.
  3. `docker compose up -d --build` in `v2/`.
  4. Verify `http://127.0.0.1:3000/api/health` and sign-in.
  5. If anything fails, stop v2 and start `career_groove` again.
- The old container and database volume remain intact for rollback.

## 14. Verification

- `bun run check` (svelte-check) passes.
- `bun run build` passes.
- Unit tests:
  - stage transitions and outcomes
  - next-action defaults
  - seeding idempotency
  - encryption round-trip
- Integration/Playwright:
  - sign in
  - add a lead from a pasted JD
  - move lead → preparing → applied
  - complete a next action and confirm the next default
  - generate a document
  - create an interview
- Manual mobile check at 390px.
- Docker health endpoint returns 200.

## 15. Acceptance criteria

1. The app runs in one container on port 3000.
2. Both kept users can sign in with their existing passwords.
3. Profile and journey data are present for both users.
4. Home shows progress and due follow-ups.
5. Applications have exactly one stage and one next action, and every view
   agrees.
6. Adding a lead from URL/JD is possible and creates a `lead`.
7. Documents can be generated and downloaded as PDF.
8. Interviews appear on the Interview dashboard.
9. No music player, native app, billing, analytics, or brand studio appears.
10. Old app and old database remain untouched and can be restarted for rollback.
