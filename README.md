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
docker compose up --build
```

Open http://breath.local:3000 (or use the server's LAN IP). The app container applies the idempotent schema and compatibility migrations before starting. OAuth, passkeys, AI providers, and GitHub feedback activate when their corresponding environment variables are configured. Passkeys additionally require `AUTH_EXPERIMENTAL_ENABLE_PASSKEYS=true` and a secure origin outside localhost.

### Nginx and mixed public/LAN access

Do not set `AUTH_URL` when the same container is accessed through public HTTPS and direct LAN HTTP. CareerGroove trusts the request host and Nginx forwarding headers, allowing Auth.js to derive the correct origin for each request. Use the proxy-header pattern in [`deploy/nginx.conf.example`](deploy/nginx.conf.example); in particular, preserve `$host` and `$scheme` rather than hardcoding either one.

Nginx should redirect public port 80 traffic to HTTPS, but direct access to the published app port (for example, `http://192.168.1.20:3000`) remains HTTP and does not enter that redirect. For better isolation, use a firewall rule to expose port 3000 only to the LAN.

OAuth providers require every callback origin to be registered with the provider. Register the public callback (for example, `https://career.example.com/api/auth/callback/github`) and any LAN callback only if the provider permits plain HTTP callbacks. Credentials sign-in works on LAN HTTP. Passkeys generally require HTTPS except on `localhost`, so use the public HTTPS hostname for passkeys.

Compose includes an Ollama service with persistent model storage bind-mounted from `OLLAMA_MODELS_DIR` on the server into `/root/.ollama` in the Ollama container. By default this uses `./.ollama` next to the project and is ignored by Git.

Install a model into that shared store with:

```bash
docker compose exec ollama ollama pull llama3.2
```

Then connect Ollama from Settings and CareerGroove will discover the installed models through `http://ollama:11434`.

If you already run Ollama directly on the server and want CareerGroove to use that daemon instead of the Compose service, set `CAREER_GROOVE_OLLAMA_BASE_URL=http://host.docker.internal:11434` in `.env` and configure the host Ollama daemon to listen on `0.0.0.0:11434`. If you want the Compose Ollama service to reuse an existing host model store, set `OLLAMA_MODELS_DIR` to that host directory before starting Compose.

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
