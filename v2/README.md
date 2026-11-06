# CareerGroove v2

A greenfield, mobile-first career workflow app. Single Docker container with
Postgres 17 and the SvelteKit app. Replaces the existing CareerGroove UI on
port 3000.

## Quick start

```sh
cp .env.example .env   # edit values
docker compose up -d --build
```

Open http://localhost:3000 and sign in. Two accounts are seeded from the
existing database backup: `rbtm2006@me.com` (admin) and
`rbtm2006@icloud.com`. Their original bcrypt password hashes are preserved.

## Stack

- SvelteKit 3 + Svelte 5 + TypeScript + Vite
- Bun for dev, scripts, and production runtime
- Postgres 17 (same container) with Drizzle ORM
- better-auth with email/password (bcrypt) and the Drizzle adapter
- Nodemailer for email, pdf-lib for PDFs
- Paper/ink design system (JetBrains Mono + system sans)

## Scripts

| Script | Description |
| --- | --- |
| `bun run dev` | Dev server on port 3001 |
| `bun run build` | Production build |
| `bun run check` | Type and Svelte checks |
| `bun scripts/migrate.ts` | Apply schema |
| `bun scripts/seed.ts` | Seed users, jobs, skills, etc. |
| `bun scripts/set-test-password.ts` | Set `rbtm2006@me.com` to `TestPass123` for local testing |
| `bun scripts/restore-test-password.ts` | Restore the original password hash |
| `bash scripts/smoke.sh` | End-to-end smoke test |

## Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string |
| `AUTH_SECRET` | yes | better-auth secret |
| `ENCRYPTION_KEY` | yes | AES-256-GCM key for stored secrets |
| `BOOTSTRAP_ADMIN_EMAIL` | yes | Email that becomes admin |
| `BETTER_AUTH_URL` | no | Public base URL |
| `PORT` | no | App port, default 3000 |

AI provider, search, and SMTP settings are stored encrypted in the database
and edited under Tools → Admin.