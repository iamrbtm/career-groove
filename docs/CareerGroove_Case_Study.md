# CareerGroove — Case Study

## 1. Overview

**Project:** CareerGroove
**Type:** Personal Career & Life CRM (Customer Relationship Manager for one's own professional life)
**Platform:** Mobile-first Progressive Web App (PWA), with native iOS app plans and a browser extension
**Tech Stack:** Next.js (App Router), React, TypeScript, PostgreSQL (JSONB), Auth.js (NextAuth), Vercel AI SDK, Octokit (GitHub), Tailwind CSS, Framer Motion
**Deployment:** Standalone (`npm run dev`) or Dockerized (`docker-compose` with app + PostgreSQL + Ollama services)
**Status:** Functional, multi-module application with AI, CRM, document generation, and feedback automation features

CareerGroove is a whimsical, music-forward personal CRM that helps individuals capture their entire career and life history, then uses AI to turn that raw history into polished achievements, interview readiness, and tailored application documents.

---

## 2. The Problem

Most professionals maintain career data in a scattered, low-fidelity way: a half-updated résumé, a few notes in a docs file, a mental list of former colleagues. When it comes time to apply for a job, write a cover letter, or prep for an interview, the work of reconstructing "what did I actually accomplish at Company X" is painful, error-prone, and slow.

Specific pain points CareerGroove addresses:

- **Fragmented history:** Work, residences, licenses, education, and certifications live in different places.
- **Story-to-bullet gap:** People can describe what they did conversationally, but struggle to convert it into crisp, recruiter-ready achievement bullets.
- **Interview anxiety:** Without context-aware practice, candidates rehearse generic answers rather than their own real stories.
- **Document drudgery:** Résumés and cover letters are rewritten from scratch for every application.
- **Relationship amnesia:** Professional networks fade from memory without a relationship-strength view.

---

## 3. The Solution

CareerGroove reframes career management as a single, playful, game-menu-like workspace where data entry feels conversational and AI does the heavy lifting.

### Core Capabilities

| Module | What it does |
| --- | --- |
| **AI Job Interviewer** | Streams provider-switched responses; converts rambling transcripts into polished achievement bullets. Saves to history. |
| **Reverse Mock Interviewer** | Context-aware interview prep that quizzes users against their own saved work history. |
| **Resume & Cover-Letter Studio** | AI-driven document generation with save, edit, and text export. |
| **Professional Contact CRM** | Tracks relationships with a visual relationship-strength graph. |
| **Life Tracking Modules** | Master tracking for work, residence, education, licenses, and certifications. |
| **GitHub Feedback Automation** | Creates labeled GitHub Issues and (optionally) adds them to a Projects v2 board. |
| **Ambient Audio Player** | Global four-station background player (Lo-Fi, Ambient, Classical, Brain Waves) with play/pause/skip/volume. |
| **Browser Extension** | Manifest V3 extension that captures a job post page and saves it into Tracker Studio via authenticated APIs. |
| **Native iOS App (planned)** | SwiftUI app reusing the same Auth.js sessions, REST APIs, and four-station audio player. |

### Design Philosophy

Per `DESIGN.md`, the product intentionally blends "a cozy video game menu crossed with a high-end productivity tool":

- **Vibe:** Whimsical, fun, action-oriented, but strictly professional in data handling.
- **Motion:** Tactile Framer Motion animations — buttons that press down, satisfying card flips / confetti on save, smooth slide/fade page transitions behaving like a native app.
- **Audio:** Integrated global music player with four focus-music stations.
- **Layout:** Mobile-first PWA with bottom nav on mobile and collapsing sidebars on desktop; conversational "wizard" or chat-based forms instead of massive vertical forms.

---

## 4. Architecture & Technical Approach

### Frontend
- **Next.js App Router** with React + TypeScript.
- **Tailwind CSS** for styling, **Framer Motion** for animation.
- **PWA shell:** installable, offline-capable, responsive navigation, manifest and service behavior.
- Modular route structure: `dashboard`, `interview`, `mock-interview`, `journey`, `network`, `documents`, `applications`, `analytics`, `settings`, `admin`, `billing`, and more.

### Backend & Data
- **Next.js API routes** (RESTful) for AI, GitHub, auth, and all CRM resources.
- **PostgreSQL** with `JSONB` for flexible, schema-light storage of career/life records.
- **Auth.js** providers: Credentials, Google, GitHub, Apple, and passkeys (WebAuthn).
- **Octokit** for GitHub Issues and Projects v2 via REST/GraphQL.

### AI Integration
- **Vercel AI SDK** wrapping OpenAI, Claude, Gemini, and local **Ollama**.
- Per-user encrypted provider connections (AES-256-GCM with `PROVIDER_ENCRYPTION_KEY`, falling back to `AUTH_SECRET`). Keys are never returned to the browser and only decrypted server-side.
- **Live model discovery** so users pick from models their configured provider actually exposes.

### Security & Multi-Origin
- All career, settings, AI, and GitHub routes require an authenticated session.
- Trusts request host + Nginx forwarding headers so a single container can serve both public HTTPS and LAN HTTP without a hardcoded `AUTH_URL`.
- Passkeys require HTTPS except on `localhost`.

### Deployment & Ops
- **Docker Compose** provisions the app, PostgreSQL, and an Ollama service with persistent model storage.
- **Application-owned backup scheduler** (`backup-scheduler` service, no host cron/systemd):
  - Source backups weekly (Wednesday midnight).
  - Database `pg_dump` backups hourly at minute 30, with hour/week compression and archival.
  - Retention of `CAREER_GROOVE_DATABASE_BACKUP_RETENTION_MONTHS` (default 6); source backups kept indefinitely.
  - State tracked in `backups/.scheduler-state.json` to avoid duplicate runs after restart.

---

## 5. Key API Surface

| Endpoint | Purpose |
| --- | --- |
| `POST /api/ai` | Streams interviewer, mock-interview, resume, or cover-letter responses with provider switching. |
| `POST /api/github/issues` | Creates a labeled feedback issue and optionally a Projects v2 card. |
| `/api/auth/*` | Auth.js providers. |
| `/api/jobs`, `/api/contacts`, `/api/residences`, `/api/credentials`, `/api/documents` | User-scoped CRM persistence. |
| `/api/settings` | Stores provider, model, motion, and music preferences. |

---

## 6. Implementation Journey

1. **Foundation:** PostgreSQL schema with `JSONB`, Dockerfile, and `docker-compose.yml` provisioning app + DB (+ Ollama).
2. **Authentication:** Auth.js route with Credentials, Google, GitHub, Apple, and passkeys.
3. **AI Wrapper:** Backend route enabling provider switching across OpenAI, Claude, Gemini, and Ollama with encrypted per-user keys.
4. **GitHub Loop:** Octokit functions create issues and project cards for in-app feedback.
5. **Design Execution:** Framer Motion specs, four-station audio player, and conversational UI built per `DESIGN.md` "skills."
6. **Expansion:** Browser extension for job capture; native iOS (SwiftUI) production plan reusing the same backend.

---

## 7. Outcomes & Value

- **Time saved:** Converts conversational history into recruiter-ready bullets instead of manual rewrites.
- **Confidence built:** Context-aware mock interviews drill users on their own real stories.
- **Consistency:** One source of truth for work, life, network, and documents.
- **Ownership:** Local/Docker deployment plus encrypted, user-held AI keys keep data and credentials private.
- **Delight:** Game-menu aesthetics, tactile motion, and ambient audio make career upkeep feel less like admin and more like play.

---

## 8. Future Directions

- Ship the native SwiftUI iOS app with Keychain session storage and a mobile token-exchange endpoint.
- Expand the relationship-strength graph with follow-up reminders and engagement analytics.
- Broaden document studio exports (PDF, ATS-optimized formats) and multi-language support.
- Add subscription/billing tiers (`/billing` route already scaffolded) and richer admin tooling.

---

### One-Paragraph Summary

CareerGroove is a mobile-first personal career and life CRM that captures a user's complete professional and life history — jobs, residences, licenses, education, certifications, and relationships — and uses swappable AI providers (OpenAI, Claude, Gemini, Ollama) to transform rough stories into polished achievement bullets, interview readiness, and tailored application documents, all wrapped in a playful, music-driven PWA experience with encrypted per-user AI keys, GitHub feedback automation, a browser extension, and a planned native iOS app.