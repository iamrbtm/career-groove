# CareerGroove v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved CareerGroove v2 as a single-container SvelteKit app in `v2/`, then cut over port 3000.

**Architecture:** SvelteKit + Svelte 5 on Bun, Postgres 17 in the same container, Drizzle ORM, better-auth, server-side form actions, Postgres-backed jobs, Nodemailer, pdf-lib. Old app and DB untouched.

**Tech Stack:** Bun 1.4, SvelteKit 2, Svelte 5, TypeScript, Postgres 17, Drizzle, better-auth, Drizzle adapter, `pg`, `bcryptjs`, Nodemailer, pdf-lib, Zod.

**Spec:** `v2/docs/specs/2026-11-05-careergroove-v2-design.md`

## Global Constraints

- Old code in the repo root is read-only. All new code goes in `v2/`.
- No music player, no audio, no native mobile APIs, no billing, no analytics.
- One Docker container containing the app and Postgres. No Redis.
- Mobile-first; 390px is the primary width.
- Paper/ink design tokens; JetBrains Mono for labels/headings/data; system sans for body.
- Only `DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`, `BOOTSTRAP_ADMIN_EMAIL` come from env.
- Full DB backup already exists at `backups/pre-v2-rewrite-20261105_220251.dump`.
- Do not commit `.env`, `seed/seed.json`, `node_modules`, `.svelte-kit`, `build`, or Postgres data.

---

### Task 1: Scaffold and design system

**Files:**
- Create: `v2/package.json`, `v2/svelte.config.js`, `v2/vite.config.ts`, `v2/tsconfig.json`
- Create: `v2/src/app.html`, `v2/src/app.css`, `v2/src/lib/styles/tokens.css`
- Create: `v2/src/routes/+layout.svelte`, `v2/src/routes/+page.svelte`
- Create: `v2/.gitignore`, `v2/.env.example`
- Test: `bun run check` and `bun run build`

- [ ] Create package and config files.
- [ ] Add global design tokens and base styles.
- [ ] Add landing page that redirects signed-in users to `/home`.
- [ ] Run `bun install`, `bun run check`, `bun run build`.
- [ ] Commit.

### Task 2: Database schema, migration, and seed

**Files:**
- Create: `v2/src/lib/server/db/schema.ts`
- Create: `v2/src/lib/server/db/index.ts`
- Create: `v2/db/schema.sql`
- Create: `v2/scripts/migrate.ts`
- Create: `v2/scripts/seed.ts`
- Create: `v2/scripts/export-seed.ts`
- Test: `bun run scripts/migrate.ts` against a local Postgres; `bun test` for seeding idempotency

- [ ] Define better-auth tables plus all career/workflow tables in Drizzle.
- [ ] Write idempotent `schema.sql`.
- [ ] Write `export-seed.ts` to query the old DB dump source and produce `seed/seed.json`.
- [ ] Write `seed.ts` to insert the two users, profiles, jobs, residences, credentials, skills, and job_skills once.
- [ ] Preserve bcrypt hashes for both users.
- [ ] Verify migration and seeding twice (idempotent).
- [ ] Commit.

### Task 3: Auth, shell, and navigation

**Files:**
- Create: `v2/src/lib/server/auth.ts`
- Create: `v2/src/routes/api/auth/[...all]/+server.ts`
- Create: `v2/src/routes/signin/+page.svelte`, `+page.server.ts`
- Create: `v2/src/routes/signout/+server.ts`
- Create: `v2/src/lib/components/AppShell.svelte`, `Nav.svelte`, `AccountMenu.svelte`
- Create: `v2/src/routes/+layout.server.ts`, `+layout.svelte`
- Test: sign in with both kept accounts; redirect to `/home`

- [ ] Configure better-auth with Drizzle adapter and bcrypt hash/verify.
- [ ] Add session hook and protected layout.
- [ ] Build responsive shell: desktop sidebar, mobile bottom nav with Home, Applications, Profile, Interview, Tools.
- [ ] Add sign-in page and sign-out action.
- [ ] Verify both accounts sign in.
- [ ] Commit.

### Task 4: Home

**Files:**
- Create: `v2/src/routes/home/+page.server.ts`, `+page.svelte`
- Create: `v2/src/lib/server/queries/home.ts`
- Test: due actions appear; counts match stage rows

- [ ] Query stage counts, active applications, interviews this week, due actions.
- [ ] Render progress snapshot, needs-attention list, upcoming interviews, quick capture.
- [ ] Add complete/snooze actions.
- [ ] Commit.

### Task 5: Applications pipeline and detail

**Files:**
- Create: `v2/src/routes/applications/+page.server.ts`, `+page.svelte`
- Create: `v2/src/routes/applications/[id]/+page.server.ts`, `+page.svelte`
- Create: `v2/src/lib/server/applications.ts`
- Create: `v2/src/lib/components/StageBoard.svelte`, `NextAction.svelte`, `Timeline.svelte`
- Test: stage machine unit tests; create/move/complete actions

- [ ] Implement stage machine, outcome validation, and default next actions.
- [ ] Build board/list views and filters.
- [ ] Build detail sections: overview, JD, fit, documents, timeline, interviews, people, research, notes.
- [ ] Add stage-change modal and next-action editor.
- [ ] Add add-lead form (manual) with parse hooks.
- [ ] Commit.

### Task 6: Profile and journey

**Files:**
- Create: `v2/src/routes/profile/+page.server.ts`, `+page.svelte`
- Create: `v2/src/routes/profile/work/+page.server.ts`, `+page.svelte`
- Create: `v2/src/lib/components/GuidedChapter.svelte`
- Create: `v2/src/lib/server/profile.ts`
- Test: create/edit/delete each entity; guided chapter saves

- [ ] Build contact/basics form.
- [ ] Build guided work-history interview flow with AI-generated bullets/skills.
- [ ] Build manual work, residences, credentials, and skills CRUD.
- [ ] Add fit preferences and resume base link.
- [ ] Commit.

### Task 7: Interview

**Files:**
- Create: `v2/src/routes/interview/+page.server.ts`, `+page.svelte`
- Create: `v2/src/routes/interview/[id]/+page.server.ts`, `+page.svelte`
- Create: `v2/src/lib/server/interviews.ts`
- Test: create/edit interview; prep notes; mock questions

- [ ] Build interview card dashboard with who/what/when/where.
- [ ] Build detail with prep notes, research, mock questions, mock interview.
- [ ] Link interviews to applications.
- [ ] Commit.

### Task 8: Documents

**Files:**
- Create: `v2/src/routes/documents/+page.server.ts`, `+page.svelte`
- Create: `v2/src/routes/documents/[id]/+page.server.ts`, `+page.svelte`
- Create: `v2/src/lib/server/documents.ts`
- Create: `v2/src/lib/server/pdf.ts`
- Test: generate Markdown and PDF; download

- [ ] Build library list and detail/preview.
- [ ] Generate tailored resume/cover letter from profile + JD via AI.
- [ ] Render PDF with pdf-lib.
- [ ] Link documents to applications.
- [ ] Commit.

### Task 9: Import and research

**Files:**
- Create: `v2/src/routes/applications/import/+page.server.ts`, `+page.svelte`
- Create: `v2/src/routes/research/+page.server.ts`, `+page.svelte`
- Create: `v2/src/lib/server/import.ts`, `v2/src/lib/server/research.ts`
- Test: parse pasted JD; parse job email; fetch URL; save research note

- [ ] Parse URL/JD with AI, with manual fallback.
- [ ] Parse pasted job email into multiple roles with preview/confirm.
- [ ] Build global research page and attach notes to applications.
- [ ] Commit.

### Task 10: Network and Admin AI settings

**Files:**
- Create: `v2/src/routes/tools/network/+page.server.ts`, `+page.svelte`
- Create: `v2/src/routes/tools/admin/+page.server.ts`, `+page.svelte`
- Create: `v2/src/lib/server/settings.ts`, `v2/src/lib/server/crypto.ts`, `v2/src/lib/server/ai.ts`
- Test: encrypt/decrypt round-trip; admin gate; test connection

- [ ] Build contacts CRUD and application links.
- [ ] Build admin settings for AI provider/model/key and search/SMTP.
- [ ] Encrypt secrets with AES-256-GCM.
- [ ] Add provider test-connection action.
- [ ] Commit.

### Task 11: Email send, log, and follow-ups

**Files:**
- Create: `v2/src/routes/follow-ups/+page.server.ts`, `+page.svelte`
- Create: `v2/src/lib/server/email.ts`
- Test: send via test SMTP; log success/failure

- [ ] Build follow-up list and composer.
- [ ] Send via Nodemailer using admin SMTP settings.
- [ ] Write `email_log` and update follow-up status.
- [ ] Commit.

### Task 12: Tests, Docker, cutover, and push

**Files:**
- Create: `v2/tests/*.test.ts`
- Create: `v2/Dockerfile`, `v2/docker-compose.yml`, `v2/scripts/entrypoint.sh`, `v2/.dockerignore`
- Create: `v2/README.md`
- Test: `bun test`, `bun run check`, `bun run build`, `docker compose up`

- [ ] Add unit tests for stages, next actions, crypto, seeding.
- [ ] Build all-in-one Docker image with Postgres 17.
- [ ] Run on 3001 and verify health, sign-in, core flows.
- [ ] Stop old `career_groove`, start v2 on 3000, verify.
- [ ] Push to GitHub.
- [ ] Run `docker compose up -d --build` and confirm health.
- [ ] If cutover fails, restart the old container and report.
