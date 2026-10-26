# CareerGroove Stability & Streamlining Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Date:** 2026-10-25
**Goal:** Fix all bugs and reliability gaps surfaced by the 2026-10-25 full audit, harden security, and streamline the user workflow — in six sequential phases, each leaving the site deployed and working.

**Architecture:** Backend correctness first (data → security → reliability), frontend streamlining last. Single supervisord container deployment (`docker compose up -d --build`) after every phase; site must return HTTP 200 on :3000 between phases.

**Tech Stack:** Next.js 15 App Router / React 19, node-pg, BullMQ/ioredis, Postgres 17 (migrations tracked in `schema_migrations`), node test runner (`npm test`), Tailwind + Framer Motion for UI.

**Spec:** `docs/superpowers/research/2026-10-25-full-audit-findings.md` (audit results; the four parallel deep-dive reports summarized there are the source of every task below)

## Global Constraints

- Never break the live deployment: after each phase, full `docker compose up -d --build` smoke test (`curl localhost:3000` → 200) before moving on.
- Migrations must run exactly once (tracked in `schema_migrations`); never edit an already-applied migration body, except the two constraint guards (014/021) already fixed 2026-10-24.
- `db/schema.sql` must remain idempotent — it runs on every container boot via `scripts/migrate.mjs`.
- No new runtime dependencies; rate limiting uses existing ioredis; no captcha packages.
- Never commit or modify `.env` content; new secret names must fall back to existing values for compatibility.
- TDD where testable (node test runner, `tests/**`); container behaviors verified via curl and `docker exec career_groove psql`.

---

## Phase 0 — Baseline & Safety Net (~30 min)

**Task 0.1 — Snapshot before touching anything**
- Files: none created (ops only)
- Steps:
  - `docker exec career_groove pg_dump -U career_groove -Fc career_groove > backups/pre-plan.dump`
  - `git status` clean check; create branch `stability-2026-10-25`
  - Run `npm test` and record results as the green baseline
- Deliverable: branch + recorded baseline + `backups/pre-plan.dump`

---

## Phase 1 — Critical Bugs (broken features today) (~1 day)

### Task 1.1 — Reprocess actually enqueues
**Files:**
- Modify: `app/api/document-jobs/[id]/reprocess/route.ts:13-22`
**Problem:** route INSERTs a job copy but never calls `enqueueDocumentJob`; row sits `pending` forever. Verify fix by calling it and watching status transition.
- [ ] Import `enqueueDocumentJob` from `@/lib/job-queue`; enqueue with the new row id after INSERT
- [ ] On enqueue failure: `UPDATE document_generation_jobs SET status='failed', error='Could not queue job' WHERE id=$1`; return 503
- [ ] Verify curl → row transitions `pending→processing` (Redis healthy container)
- [ ] Commit: `fix(document-jobs): enqueue reprocessed jobs`

### Task 1.2 — Follow-up POST: correct status + safe due-date update + transaction
**Files:**
- Modify: `lib/db.ts` (add helper)
- Modify: `app/api/follow-ups/route.ts:50-68`
**Problem:** inserts `draft` even when a date is given (invisible to worker), and unconditionally NULLs `applications.follow_up_due_at`.
- [ ] Add to `lib/db.ts`:
```ts
import { Pool, type PoolClient } from "pg";
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
```
- [ ] Rewire POST as single `withTransaction`: INSERT uses `status = CASE WHEN $7::timestamptz IS NULL THEN 'draft' ELSE 'scheduled' END` with `scheduledFor` as `$7`; applications UPDATE only runs when `scheduledFor` is non-null
- [ ] Verify: POST with date → `status='scheduled'` + due date set; POST without date → `draft`, existing due date untouched
- [ ] Commit: `fix(follow-ups): scheduled status, preserve due date, wrap in tx`

### Task 1.3 — Follow-up reminder dedupe (kill the hourly nag)
**Files:**
- Create: `db/migrations/022_follow_up_reminder_dedupe.sql`
- Modify: `app/api/internal/follow-up-worker/route.ts:53-77`
**Problem:** route re-pushes identical notification hourly with no dedupe (unlike mobile-notifications route).
- [ ] Migration:
```sql
ALTER TABLE application_follow_ups ADD COLUMN IF NOT EXISTS reminded_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS follow_ups_reminder_idx
  ON application_follow_ups (status) WHERE status IN ('draft', 'scheduled');
```
- [ ] Notification select adds `AND (af.reminded_at IS NULL OR af.reminded_at < now() - interval '24 hours')`
- [ ] After successful APNs send: `UPDATE application_follow_ups SET reminded_at = now() WHERE id = ANY($1::uuid[])`
- [ ] Overdue query gets `ORDER BY scheduled_for LIMIT 50` (was unordered)
- [ ] Verify: two worker cycles → second sends 0 pushes
- [ ] Commit: `fix(follow-ups): dedupe reminders to once per 24h`

### Task 1.4 — CSV import: tier cap + work_mode whitelist
**Files:**
- Modify: `app/api/applications/import/route.ts:28-33,54-92`
- [ ] Normalize `workMode` like `status`: whitelist lowercase map to `remote|hybrid|onsite` else `null` (prevents raw 23514 rollback of whole file)
- [ ] Call `getUserTier()`; free tier beyond 5 rows → import first 5, return `{ imported, skipped }`
- [ ] Verify: 7-row CSV as free user → 5 + skipped; `workMode: "Remote"` stored as `remote`
- [ ] Commit: `fix(import): tier cap + work_mode normalization`

### Task 1.5 — Email connections: kill the race + duplicate-active rows
**Files:**
- Modify: `app/api/email-connections/route.ts:44-92`
- [ ] Replace check-then-insert with single `ON CONFLICT (user_id, provider)` upsert inside `withTransaction` (Task 1.2 helper)
- [ ] Update branch deactivates siblings: `UPDATE email_connections SET active=false WHERE user_id=$1 AND provider=$2 AND id<>$3`
- [ ] UUID-validate ids (query string and body) → 400 not 500
- [ ] Verify: double POST → one row, exactly one `active=true`; delete `?id=notauuid` → 400
- [ ] Commit: `fix(email-connections): atomic upsert, single active row`

### Task 1.6 — Document enqueue can't orphan rows
**Files:**
- Modify: `app/api/document-jobs/route.ts:85-104`
- [ ] Wrap INSERT + `enqueueDocumentJob` in try; on enqueue error set row `failed` / `Queue unavailable`, return 503 `{error, jobId}`
- [ ] Commit: `fix(document-jobs): mark row failed when queue is down`

### Phase 1 verification
- [ ] `docker compose up -d --build`; `docker logs career_groove --since 2m` clean; `curl localhost:3000` → 200
- [ ] `Applied 0 of N migrations` on boot + migration 022 present in tracking table

---

## Phase 2 — Schema Baseline & Migration Hygiene (~half day)

### Task 2.1 — Regenerate `db/schema.sql` (CAUTION: verify against live data, snapshot exists)
**Files:**
- Modify: `db/schema.sql`
**Problem:** schema.sql drifted from migrations — fresh installs 500 (`current_step` missing), `contacts_user_job_name_idx` missing (jobs POST ON CONFLICT fails), `email_send_log`/`task_model_mappings`/`admins`/`settings` missing, provider CHECK stale at 4 providers.
- [ ] `pg_dump --schema-only --no-owner --no-acl` from live DB → hand-edit to idempotent form (`CREATE TABLE IF NOT EXISTS` etc.), skip data-dependent sections
- [ ] Verify every migration artifact present: `applications.current_step`, `contacts_user_job_name_idx`, `email_send_log`, `task_model_mappings`, `admins`, `settings`, 6-provider CHECK, `schema_migrations` itself
- [ ] Prove: run `scripts/migrate.mjs` twice against throwaway Postgres (fresh: `Applied 22→0`) + boot throwaway container check 200
- [ ] Commit: `chore(db): regenerate schema.sql to post-021 state`

### Task 2.2 — De-duplicate migration number collisions (optional, low risk)
- [ ] Rename second `017_*` → `017b_*`, second `018_*` → `018b_*` (tracking table: names are new; bodies idempotent, safe)
- [ ] Verify boot: `Applied 0` (no resurrection)
- [ ] Commit: `chore(db): unique migration numbering`

---

## Phase 3 — Security Hardening (~1 day)

### Task 3.1 — Encrypt premium AI key at rest
**Files:**
- Modify: `app/api/admin/settings/route.ts`
- Reuse: `lib/secret-box.ts` (`encryptSecret`/`decryptSecret`)
- [ ] PATCH: encrypt `premium_ai_config.api_key` before storing; GET: strip key, return `{...cfg, apiKeyConfigured, apiKeyHint}` (last4)
- [ ] One-time live repair: existing plaintext key re-encrypted via admin PATCH (manual, documented)
- [ ] Commit: `fix(admin): encrypt premium AI key`

### Task 3.2 — Admin claim race + setup token
**Files:**
- Modify: `app/api/admin/claim/route.ts`
- [ ] Atomic claim: `INSERT INTO admins (user_id) SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM admins)` → 403 when 0 rows
- [ ] Optional `CAREER_GROOVE_SETUP_TOKEN` env: timing-safe header `x-setup-token` check when set
- [ ] Commit: `fix(admin): atomic claim, optional setup token`

### Task 3.3 — SSRF-hardened URL fetcher
**Files:**
- Create: `lib/fetch-url.ts` (export `safeFetchUrl(url, timeoutMs)`, `isPrivateIp`)
- Modify: `app/api/applications/parse-url/route.ts:33-52`, `lib/research.ts:37-50`
**Spec:** reject non-http(s); resolve all DNS addresses and reject private/link-local/CGNAT/ULA + IPv6 v4-mapped; `redirect: "manual"` loop max 5, re-resolve every hop; `AbortSignal.timeout(10000)`; parse-url temp file becomes `crypto.randomUUID()` name.
- [ ] Unit tests (no network: mock dns) covering private literals, mapped IPs, decimal forms
- [ ] Wire both call sites → 400 with existing wording
- [ ] Commit: `fix: SSRF-safe URL fetching with redirect validation`

### Task 3.4 — Rate limiting
**Files:**
- Create: `lib/rate-limit.ts` (fixed-window counters in ioredis; export `limitUser`, `limitIp`)
- Modify: `app/api/ai/route.ts`, `parse-url`, `research-bot`, `app/api/register/route.ts`
- Limits (env-overridable): AI 60/hr/user; parse-url 10/hr/user; research-bot 10/hr/user; register 5/hr/IP → 429 `{error:"Slow down — try again in a bit."}`
- [ ] Unit test fixed-window logic with stubbed redis
- [ ] Commit: `feat: redis-backed rate limits on AI and URL endpoints`

### Task 3.5 — Internal endpoint secrets
**Files:**
- Modify: `app/api/internal/follow-up-worker/route.ts:5-10`, `scripts/follow-up-worker.mjs:3`
- [ ] `timingSafeEqual`; accept `FOLLOW_UP_WORKER_SECRET || MOBILE_NOTIFICATION_WORKER_SECRET`
- [ ] Commit: `fix(internal): timing-safe, distinct worker secrets`

### Task 3.6 — Small hardening batch
- [ ] `app/api/jobs/[id]/route.ts:50` job_skills delete gets ownership predicate
- [ ] `app/api/mobile/push-devices/route.ts:31-41` → 409 instead of silent steal when token bound to different user
- [ ] `next.config.ts` security headers: nosniff, Referrer-Policy strict-origin-when-cross-origin, X-Frame-Options SAMEORIGIN
- [ ] Commit: `fix: defense-in-depth small batch`

### Phase 3 verification
- [ ] Rebuild + 200 + manual: admin settings GET no longer contains api_key; claim double-post → single row

---

## Phase 4 — Reliability (~1 day)

### Task 4.1 — DB reaper for stalled document jobs
**Files:**
- Modify: `scripts/document-worker.mjs`
- [ ] Interval 5 min: `pending`/`processing` with `updated_at < now() - interval '30 minutes'` cap 10/pass; `metadata->>'reapCount' >= 2` → fail with clean error; else increment and re-enqueue with `jobId:'${id}:reap:${count}'`
- [ ] Commit: `feat(pipeline): reap stalled document jobs`

### Task 4.2 — Weekly source backup via /workspace mount
**Files:**
- Modify: `docker-compose.yml` (volume `./:/workspace`, env `CAREER_GROOVE_BACKUP_SOURCE_ROOT: /workspace`)
- Modify: `scripts/backup/source-weekly.sh:12-20` (`SRC` from env; clear `exit 1` + log when `.git` missing)
- [ ] Verify `docker compose exec app sh scripts/backup/source-weekly.sh` → tar in backups/
- [ ] Commit: `fix(backup): source backup uses host workspace mount`

### Task 4.3 — Backup sanity + pacing
**Files:**
- Modify: `scripts/backup/database-hourly.sh` (pg_restore --list validation; drop dead compose-fallback), `scripts/backup/scheduler.mjs` (maintenance hourly)
- [ ] Commit: `fix(backup): validate dumps, hourly maintenance`

### Task 4.4 — DB-aware healthcheck + latch fix
**Files:**
- Create: `app/api/health/route.ts` (SELECT 1 + redis ping → 200/503)
- Modify: `docker-compose.yml` healthcheck, `deploy/db-init.sh` (3 retries → exit non-zero)
- [ ] Verify: stop postgres → health 503; restart → 200
- [ ] Commit: `fix(ops): db/redis-aware healthcheck`

---

## Phase 5 — AI Provider Parity (~2 h)

### Task 5.1 — document-worker nvidia/kilo parity
**Files:**
- Modify: `scripts/document-worker.mjs:51-60`
- [ ] Factory cases mirror `lib/ai.ts`: nvidia → `integrate.api.nvidia.com/v1`, kilo → OpenAI-compatible base from lib/ai.ts; thrown creation errors become per-connection `last_error`
- [ ] Align `lib/provider-models.ts:30` vs `lib/ai.ts:12` nvidia base URLs
- [ ] Commit: `fix(ai): nvidia/kilo support in document worker`

---

## Phase 6 — UX Streamlining (~3–4 d)

### Task 6.1 — Shared apiFetch + toasts; fix silent failures
- [ ] Create `lib/ui/api-fetch.ts`, `lib/ui/toast.tsx` (`<Toaster>` mounted in app/layout.tsx)
- [ ] Rewire tracker `advanceStep`/`handleArchive`, follow-up dashboard mutations
- [ ] Commit: `fix(ui): surfaced mutation failures + toast system`

### Task 6.2 — Onboarding funnel
- [ ] Create `/onboarding` wizard + `app/api/user/onboarding` completeness GET
- [ ] register-form redirect; dashboard hero replaced for incomplete profiles
- [ ] Commit: `feat(onboarding): first-run wizard`

### Task 6.3 — Journey quick-add (manual chapter)
- [ ] journey-manager.tsx manual form → POST `/api/jobs`
- [ ] Commit: `feat(journey): manual chapter entry`

### Task 6.4 — Follow-up edit-and-send one screen
- [ ] follow-up-dashboard dialog: editable draft + recipient pick + send
- [ ] Commit: `feat(follow-ups): edit-and-send in one step`

### Task 6.5 — One JD → application → documents
- [ ] capture-modal post-capture generate CTA; document-studio prefill from selected application
- [ ] Commit: `feat(flow): capture-and-generate`

### Task 6.6 — Merge dashboard into AppShell
- [ ] Create `lib/hooks/useTier.ts`; dashboard renders inside AppShell; single tier fetch
- [ ] Commit: `refactor(shell): unify nav + tier hook`

### Task 6.7 — Tracker document polling parity
- [ ] 3s poll while documentJobs pending/processing
- [ ] Commit: `fix(tracker): live document status`

### Task 6.8 — Guard /interview + inert button + palette
- [ ] Server-side tier guard on /interview; delete inert "See all tools"; add missing tailwind `lilac` token
- [ ] Commit: `fix(navigation): tier guard, inert button, palette`

### Task 6.9 — Confirm before destroying
- [ ] Shared Confirm on journey/network deletes
- [ ] Commit: `feat(ui): confirm on destructive actions`

### Task 6.10 — Mobile nav 5 items + sheet + a11y
- [ ] 5-item bottom bar, overflow in "More" sheet; aria labels/current; Link semantics
- [ ] Commit: `feat(nav): mobile grouping + a11y`

### Task 6.11 — Copy/consistency
- [ ] signin password 10-char parity
- [ ] Commit: `chore: copy + validation parity`

---

## Phase 7 — Backlog (not this plan; separate plans later)

1. Follow-up template campaigns (trigger_event/delay_days automation)
2. Gmail/Outlook refresh tokens + expiry pre-check
3. opened_at/replied_at capture for analytics
4. jobEmailImportEntrySchema consolidation

---

## Verification Protocol (every phase)

```
npm test && npx next build
docker compose up -d --build
docker logs career_groove --since 2m   # no crash loops
curl -s -o /dev/null -w '%{http_code}' localhost:3000   # 200
```

High-caution tasks requiring explicit user sign-off: 2.1 (schema regen), 1.2/1.5 (SQL rewrites).
