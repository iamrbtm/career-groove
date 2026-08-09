# CareerGroove

A mobile-first personal career and life CRM built with Next.js, PostgreSQL, Auth.js, the Vercel AI SDK, Octokit, Tailwind CSS, and Framer Motion. It captures career and life history, turns rough stories into polished achievements, prepares users for interviews, and generates tailored application documents.

## Features

- AI Job Interviewer with streaming provider-switched responses and save-to-history
- Context-aware reverse mock interviewer using saved work history
- Resume and cover-letter studio with saving and text export
- Professional contact CRM with a relationship-strength graph
- Work, residence, education, license, and certification tracking
- Credentials, Google, GitHub, Apple, and optional passkey authentication
- Encrypted per-user OpenAI, Claude, Gemini, and local Ollama connections with live model discovery
- GitHub Issues and Projects v2 feedback automation
- Persistent AI/music preferences and a global four-station ambient player
- Installable, offline-capable PWA shell with responsive bottom/side navigation
- Browser extension for capturing job posts into Tracker Studio

## Run locally

1. Copy `.env.example` to `.env` and set `AUTH_SECRET`.
2. Start PostgreSQL and set `DATABASE_URL`.
3. Run `npm install`, `npm run db:migrate`, then `npm run dev`.

## Run with Docker

```bash
cp .env.example .env
docker compose up -d --build
docker compose --profile workers up -d --build
```

Open http://breath.local:3000 (or use the server's LAN IP). The app container applies the idempotent schema and compatibility migrations before starting. OAuth, passkeys, AI providers, and GitHub feedback activate when their corresponding environment variables are configured. Passkeys additionally require `AUTH_EXPERIMENTAL_ENABLE_PASSKEYS=true` and a secure origin outside localhost.

### Nginx and mixed public/LAN access

Do not set `AUTH_URL` when the same container is accessed through public HTTPS and direct LAN HTTP. CareerGroove trusts the request host and Nginx forwarding headers, allowing Auth.js to derive the correct origin for each request. Use the proxy-header pattern in [`deploy/nginx.conf.example`](deploy/nginx.conf.example); in particular, preserve `$host` and `$scheme` rather than hardcoding either one.

Nginx should redirect public port 80 traffic to HTTPS, but direct access to the published app port (for example, `http://192.168.1.20:3000`) remains HTTP and does not enter that redirect. For better isolation, use a firewall rule to expose port 3000 only to the LAN.

OAuth providers require every callback origin to be registered with the provider. Register the public callback (for example, `https://career.example.com/api/auth/callback/github`) and any LAN callback only if the provider permits plain HTTP callbacks. Credentials sign-in works on LAN HTTP. Passkeys generally require HTTPS except on `localhost`, so use the public HTTPS hostname for passkeys.

CareerGroove connects to a host Ollama daemon from containers through `host.docker.internal`. Configure the host daemon to listen on `0.0.0.0:11434`; the default `.env.example` value is `http://host.docker.internal:11434`.

## Job email import

CareerGroove imports jobs only from the JSON block appended to an email:

```text
BEGIN_JOB_JSON
{"schema_version":"1.0","generated_at":"2026-08-09T12:00:00-07:00","search_run_date":"2026-08-09","jobs_found":1,"jobs":[{"job_id":"rippling-implementation-specialist-platform","dedupe_key":"38481670bcadac7c953e4ae0e0225b6b064d41ac8bfa17636f757204b68f428b","title":"Implementation Specialist, Platform","company":"Rippling","location":"United States","work_arrangement":"remote","posting_date":null,"posting_date_text":"Current active posting; exact posting date not shown","discovered_date":"2026-08-09","salary":{"min":53550,"max":89775,"currency":"USD","period":"year","raw":"$53,550-$89,775 depending on U.S. location tier"},"why_match":"Strong implementation and workflow fit.","notable_gaps":"Requests SaaS implementation experience.","apply_url":"https://example.com/job","canonical_url":"https://example.com/job","source_job_id":"12345"}]}
END_JOB_JSON
```

No JSON means no import. Invalid JSON means no import. The prose portion of the email is for the human reader only.

To rebuild only the backup scheduler:

```bash
docker compose --profile workers build backup-scheduler
docker compose --profile workers up -d --no-deps backup-scheduler
```

## Backups

CareerGroove runs backups from an application-owned Docker Compose service named `backup-scheduler`; it does not depend on cron, systemd timers, or host OS jobs.

- Source backups run every Wednesday at midnight local container time.
- Database backups run every hour at minute `30`.
- Database backup maintenance runs from the same scheduler and catches up after restarts.
- Source backups use `.gitignore` rules through `git ls-files -co --exclude-standard`.
- Database backups use `pg_dump` against `DATABASE_URL`.
- Database archives are kept for `CAREER_GROOVE_DATABASE_BACKUP_RETENTION_MONTHS` calendar months, defaulting to `6`; source backups are kept indefinitely.

Database backups are organized as:

```text
backups/database/<year>/<week>/<day-date>/<hour>/
```

Example:

```text
backups/database/2026/WK30/Wed22/13/career_groove_db_20260722_133000.dump
```

After the `23:30` database backup, that day's hour folders are compressed into the week folder:

```text
backups/database/2026/WK30/Thu23_database_backup.tar.gz
```

After Sunday's `23:30` database backup, the completed week is compressed and moved to:

```text
backups/archive/2026_Wk30_database.tar.gz
```

If daily or weekly compression fails, the scheduler logs the failure, retries once, and leaves the original files in place if the retry also fails.

The scheduler stores its last-run state in `backups/.scheduler-state.json` to avoid duplicate backups after restarts. `backups/` is ignored by Git and Docker.

## API routes

- `POST /api/ai` streams interviewer, mock-interview, resume, or cover-letter responses with provider switching.
- `POST /api/github/issues` creates a labeled feedback issue and optionally adds it to a GitHub Projects v2 board.
- `/api/auth/*` exposes Auth.js providers.
- `/api/jobs`, `/api/contacts`, `/api/residences`, `/api/credentials`, and `/api/documents` persist user-scoped CRM data.
- `/api/settings` stores provider, model, motion, and music preferences.

All career, life, settings, AI, and GitHub API routes require an authenticated session. User-entered provider keys are encrypted with AES-256-GCM using `PROVIDER_ENCRYPTION_KEY` (or `AUTH_SECRET` as a fallback), never returned to the browser, and only decrypted server-side for provider requests.

## Browser extension

CareerGroove includes an unpacked Manifest V3 extension in [`browser-extension`](browser-extension). It captures the active job post page, previews the parsed opportunity, and saves it through the existing authenticated Tracker Studio APIs.

## Verification

```bash
npm run typecheck
npm run build
docker compose config --quiet
docker compose up -d --build
```
