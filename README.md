# CareerGroove

A universal career and life CRM built with Expo SDK 57, React Native,
Expo Router, Hono, and PostgreSQL. One application now targets iOS, Android,
and the web while the API remains independently deployable.

## Features

- AI Job Interviewer with encrypted, per-user provider selection
- Context-aware reverse mock interviewer using saved work history
- Resume and cover-letter studio with saving and text export
- Professional contact CRM with a relationship-strength graph
- Work, residence, education, license, and certification tracking
- Credentials, Google, GitHub, and Sign in with Apple authentication
- Encrypted per-user OpenAI, Claude, Gemini, and local Ollama connections with live model discovery
- Persistent AI/music preferences and a global four-station ambient player
- Responsive native and web navigation with secure native token storage
- SSRF-safe pasted job-post capture and deterministic application remixing

## Run locally

1. Copy `.env.example` to `.env` and replace every required placeholder.
2. Run `npm ci`.
3. Start the API with `npm run dev --workspace @career-groove/api`.
4. Start Expo with `npm run start --workspace @career-groove/mobile`.

## Run with Docker

```bash
cp .env.example .env
docker compose up --build
```

Open `http://localhost:3000`. The public, unprivileged nginx container serves
the static Expo web export and proxies `/api` to the private Hono service.
The API applies additive PostgreSQL migrations under an advisory lock before it
accepts traffic. Passkeys are intentionally not advertised because Expo SDK 57
does not provide a production-ready cross-platform passkey flow.

### Public origin and OAuth

Set `ALLOWED_ORIGINS` to the exact comma-separated HTTPS origins that may call
the API and build the web image with the same public origin in
`EXPO_PUBLIC_API_URL`. Register
`https://<public-origin>/api/mobile/auth/oauth/complete` with Google and GitHub.
Apple uses the native identity token flow and the bundle identifier configured
in `apps/mobile/app.json`.

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

## API

- `POST /api/ai` generates interviewer, mock-interview, resume, or cover-letter responses with provider failover.
- `/api/mobile/auth/*` exposes credentials, PKCE OAuth, Apple, refresh rotation, and sign-out.
- `/api/jobs`, `/api/contacts`, `/api/residences`, `/api/credentials`, and `/api/documents` persist user-scoped CRM data.
- `/api/settings` stores provider, model, motion, and music preferences.

All user data and AI routes require a short-lived bearer access token. Refresh
tokens are rotated and replay revokes the session family. Provider keys are
encrypted with AES-256-GCM using the mandatory `PROVIDER_ENCRYPTION_KEY`, never
returned to the client, and only decrypted server-side for provider requests.

## Verification

```bash
npm test --workspace @career-groove/shared
npm test --workspace @career-groove/api
npm test --workspace @career-groove/mobile
npm run typecheck --workspace @career-groove/shared
npm run typecheck --workspace @career-groove/api
npm run typecheck --workspace @career-groove/mobile
(cd apps/mobile && npx expo-doctor)
npm run build --workspace @career-groove/mobile
docker compose config --quiet
docker compose up -d --build
```

## Production image deployment

The release workflow publishes API, web, worker, and backup images to GHCR with
both an immutable commit-SHA tag and the moving `latest` tag. Production
deployments must select the immutable tag:

```bash
./deploy/deploy-images.sh <40-character-main-commit-sha>
```

The deployment script pulls the selected images and runs Compose with
`--no-build`, ensuring the production host does not accumulate application build
layers.

Host Docker storage is configured by the versioned files in `deploy/`.
`docker-disk-monitor` runs every 15 minutes and writes warning/critical events to
the system journal at 75%/85% usage. `docker-cache-prune` removes cache unused
for seven days every Sunday at 03:15.
