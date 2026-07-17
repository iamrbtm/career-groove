# CareerGroove

A mobile-first personal career and life CRM built with Next.js, PostgreSQL, Auth.js, the Vercel AI SDK, Octokit, Tailwind CSS, and Framer Motion. It captures career and life history, turns rough stories into polished achievements, prepares users for interviews, and generates tailored application documents.

## Features

- AI Job Interviewer with streaming provider-switched responses and save-to-history
- Context-aware reverse mock interviewer using saved work history
- Resume and cover-letter studio with saving and text export
- Professional contact CRM with a relationship-strength graph
- Work, residence, education, license, and certification tracking
- Credentials, Google, GitHub, Apple, and optional passkey authentication
- OpenAI, Claude, Gemini, and local Ollama model support
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

Open http://localhost:3000. The app container applies the idempotent schema and compatibility migrations before starting. OAuth, passkeys, AI providers, and GitHub feedback activate when their corresponding environment variables are configured. Passkeys additionally require `AUTH_EXPERIMENTAL_ENABLE_PASSKEYS=true` and a secure origin outside localhost.

## API routes

- `POST /api/ai` streams interviewer, mock-interview, resume, or cover-letter responses with provider switching.
- `POST /api/github/issues` creates a labeled feedback issue and optionally adds it to a GitHub Projects v2 board.
- `/api/auth/*` exposes Auth.js providers.
- `/api/jobs`, `/api/contacts`, `/api/residences`, `/api/credentials`, and `/api/documents` persist user-scoped CRM data.
- `/api/settings` stores provider, model, motion, and music preferences.

All career, life, settings, AI, and GitHub API routes require an authenticated session. Provider API keys are read only from server-side environment variables and are never returned to the browser.

## Verification

```bash
npm run typecheck
npm run build
docker compose config --quiet
docker compose up -d --build
```
