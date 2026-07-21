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

Compose includes an Ollama service with persistent model storage. Install a model once with `docker compose exec ollama ollama pull llama3.2`, then connect Ollama from Settings. If the Compose service is unavailable, CareerGroove falls back through `OLLAMA_BASE_URL`, `host.docker.internal:11434`, and `localhost:11434`.

## API routes

- `POST /api/ai` streams interviewer, mock-interview, resume, or cover-letter responses with provider switching.
- `POST /api/github/issues` creates a labeled feedback issue and optionally adds it to a GitHub Projects v2 board.
- `/api/auth/*` exposes Auth.js providers.
- `/api/jobs`, `/api/contacts`, `/api/residences`, `/api/credentials`, and `/api/documents` persist user-scoped CRM data.
- `/api/settings` stores provider, model, motion, and music preferences.

All career, life, settings, AI, and GitHub API routes require an authenticated session. User-entered provider keys are encrypted with AES-256-GCM using `PROVIDER_ENCRYPTION_KEY` (or `AUTH_SECRET` as a fallback), never returned to the browser, and only decrypted server-side for provider requests.

## Verification

```bash
npm run typecheck
npm run build
docker compose config --quiet
docker compose up -d --build
```
