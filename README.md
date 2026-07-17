# CareerGroove

A mobile-first personal career and life CRM built with Next.js, PostgreSQL, Auth.js, the Vercel AI SDK, Octokit, Tailwind CSS, and Framer Motion.

## Run locally

1. Copy `.env.example` to `.env` and set `AUTH_SECRET`.
2. Start PostgreSQL and apply `db/schema.sql`.
3. Run `npm install`, then `npm run dev`.

## Run with Docker

```bash
cp .env.example .env
docker compose up --build
```

Open http://localhost:3000. OAuth, passkeys, AI providers, and GitHub feedback activate when their corresponding environment variables are configured. Passkeys additionally require `AUTH_EXPERIMENTAL_ENABLE_PASSKEYS=true` and a secure origin outside localhost.

## API routes

- `POST /api/ai` streams interviewer, mock-interview, resume, or cover-letter responses with provider switching.
- `POST /api/github/issues` creates a labeled feedback issue and optionally adds it to a GitHub Projects v2 board.
- `/api/auth/*` exposes Auth.js providers.
