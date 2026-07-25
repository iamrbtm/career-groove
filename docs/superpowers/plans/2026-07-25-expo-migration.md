# CareerGroove Expo Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Next.js and SwiftUI clients with one Expo SDK 57 universal application and move HTTP APIs to a production-hardened Hono service without losing existing behavior.

**Architecture:** Use an npm/Turborepo monorepo with `apps/mobile`, `packages/api`, and `packages/shared`. Hono owns `/api`, an nginx container serves the statically exported Expo web application and proxies API traffic, and PostgreSQL plus existing asynchronous workers remain separate services. Domain services accept an injected database interface so route behavior is unit-testable without a live database.

**Tech Stack:** Expo SDK 57, Expo Router 57, React Native, NativeWind, Reanimated, TanStack Query, Hono, Zod, PostgreSQL 16, Vitest, Turborepo, Docker Compose, nginx.

## Global Constraints

- Preserve every route and user-visible capability reported by the clean Next.js production build.
- Preserve the database schema and existing data; use additive migrations until final cutover.
- Do not use wildcard CORS with credentials. Allow only configured origins.
- Store native credentials in SecureStore and store only SHA-256 token digests in PostgreSQL.
- Require PKCE S256, one-time OAuth codes, exact redirect URI validation, refresh-token rotation, and replay revocation.
- Keep worker services operational throughout the migration.
- Pin the Expo dependency graph using `npx expo install` and validate it with `expo-doctor`.
- Keep the legacy applications until the replacement passes the feature-parity gate.
- Every behavioral change follows red-green-refactor; configuration is validated with executable smoke checks.

---

### Task 1: Monorepo and shared contracts

**Files:**
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `packages/shared/src/**/*.ts`
- Create: `packages/shared/test/**/*.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: versioned Zod request/response contracts and inferred domain types exported by `@career-groove/shared`.

- [ ] Add contract tests that describe database-to-API serialization, validation boundaries, and auth token payloads.
- [ ] Run the tests and confirm they fail because the shared package does not exist.
- [ ] Add workspace configuration, shared schemas, serializers, constants, and strict TypeScript configuration.
- [ ] Run shared tests, typecheck, and build.
- [ ] Commit and push.

### Task 2: Hono runtime foundation

**Files:**
- Create: `packages/api/src/app.ts`
- Create: `packages/api/src/server.ts`
- Create: `packages/api/src/config.ts`
- Create: `packages/api/src/db.ts`
- Create: `packages/api/src/middleware/*.ts`
- Create: `packages/api/test/foundation.test.ts`

**Interfaces:**
- Consumes: shared error and auth contracts.
- Produces: `createApp(dependencies)` and a Node server entry point.

- [ ] Test health, request IDs, structured errors, body limits, secure headers, configured CORS, and graceful shutdown.
- [ ] Confirm the tests fail against the missing runtime.
- [ ] Implement the dependency-injected Hono application and PostgreSQL pool lifecycle.
- [ ] Run tests, typecheck, and container build.
- [ ] Commit and push.

### Task 3: Authentication and account APIs

**Files:**
- Create: `packages/api/src/domains/auth/**/*.ts`
- Create: `packages/api/src/domains/account/**/*.ts`
- Create: `packages/api/test/auth/**/*.test.ts`

**Interfaces:**
- Produces: credentials registration/sign-in, PKCE OAuth, Apple identity exchange, passkeys, access refresh, sign-out, account, billing status, push-device, and StoreKit endpoints.

- [ ] Reproduce security-critical behavior from `lib/mobile-auth.ts` and existing mobile routes in failing tests.
- [ ] Implement auth services and thin Hono route adapters.
- [ ] Test token replay, expiry, rate limits, redirect allowlists, account isolation, and constant-shape errors.
- [ ] Run the mobile-auth integration suite against Hono.
- [ ] Commit and push.

### Task 4: Core career-data APIs

**Files:**
- Create: `packages/api/src/domains/{jobs,contacts,residences,credentials,skills}/**/*.ts`
- Create: matching API tests.

**Interfaces:**
- Produces: authenticated CRUD with camelCase JSON and ownership checks.

- [ ] Add failing contract tests for list, get, create, partial update, delete, conflicts, and malformed IDs.
- [ ] Implement parameterized queries and explicit column maps.
- [ ] Verify every mutation is scoped by `user_id`.
- [ ] Run tests and commit.

### Task 5: Application workflow APIs

**Files:**
- Create: `packages/api/src/domains/applications/**/*.ts`
- Create: matching API tests and PostgreSQL integration fixtures.

**Interfaces:**
- Produces: applications, answers, contacts, documents, events, interviews, outcomes, scoring, conversion, submission, import/export, parsing, analytics, insights, preferences, and command-session endpoints.

- [ ] Capture current endpoint responses and edge cases in failing tests.
- [ ] Implement application aggregates and subresources transactionally.
- [ ] Test tenant isolation, state transitions, idempotency, pagination, and import limits.
- [ ] Verify against PostgreSQL and commit in reviewable domain slices.

### Task 6: Documents, providers, AI, billing, GitHub, and webhooks

**Files:**
- Create: remaining `packages/api/src/domains/*`.
- Create: matching unit and integration tests.

**Interfaces:**
- Produces: current provider, document, document-job, AI streaming, Stripe, App Store, GitHub, and internal-worker contracts.

- [ ] Add failing tests for provider-key encryption, SSRF-safe model discovery, webhook signatures/idempotency, worker authentication, and AI stream cancellation.
- [ ] Port current services with injected external clients.
- [ ] Preserve document-worker database queue semantics.
- [ ] Run tests, rebuild API image, and commit.

### Task 7: Expo foundation and design system

**Files:**
- Create: `apps/mobile/app.json`, `apps/mobile/eas.json`, and Expo build configuration.
- Create: `apps/mobile/src/design/**`, providers, API client, query keys, and auth state.
- Create: component and hook tests.

**Interfaces:**
- Consumes: shared contracts and Hono endpoints.
- Produces: universal routing, guarded sessions, responsive navigation, SecureStore token persistence, refresh serialization, accessibility primitives, music controls, and motion preferences.

- [ ] Generate an SDK 57 application and pin Expo-compatible dependencies.
- [ ] Add failing tests for auth bootstrap, one-flight refresh, sign-out, deep links, and responsive navigation.
- [ ] Implement the CareerGroove visual and motion system using native primitives and Reanimated.
- [ ] Validate web, iOS, Android, reduced-motion, keyboard, and screen-reader behavior.
- [ ] Commit and push.

### Task 8: Universal feature screens

**Files:**
- Create: Expo Router routes and feature components under `apps/mobile`.
- Create: screen/component tests.

**Interfaces:**
- Produces: landing, authentication, dashboard, journey, tracker, analytics, network, documents, settings, billing, profile, provider connections, interviewer, and mock-interview experiences.

- [ ] Port screens feature-by-feature with failing interaction tests first.
- [ ] Replace browser-only APIs with platform adapters.
- [ ] Add loading, empty, offline, error, and retry states.
- [ ] Preserve the whimsical musical identity while meeting WCAG AA contrast and native accessibility expectations.
- [ ] Export web and run native bundle checks after every feature group.
- [ ] Commit and push in feature groups.

### Task 9: Production topology and worker cutover

**Files:**
- Create: production Dockerfiles and nginx configuration.
- Modify: `docker-compose.yml`, worker configuration, migrations, and environment documentation.
- Create: topology smoke tests.

**Interfaces:**
- Produces: nginx on the public port, private Hono/API and PostgreSQL services, immutable Expo web assets, health checks, and operational worker routes.

- [ ] Add failing smoke checks for SPA fallback, cache headers, API proxying, health, uploads, streaming, and worker callbacks.
- [ ] Implement multi-stage reproducible images and non-root runtime users.
- [ ] Add Compose health/dependency conditions, resource-safe shutdown, and secrets documentation.
- [ ] Build and test the full stack from clean volumes and upgraded existing data.
- [ ] Commit and push.

### Task 10: Release gate and legacy removal

**Files:**
- Modify: CI, README, runbooks, and deployment documentation.
- Delete only after gate: legacy `app`, `components`, `lib`, and `ios`.

**Interfaces:**
- Produces: one production-ready Expo/Hono codebase with rollback documentation.

- [ ] Run contract, unit, integration, end-to-end, type, lint, audit, Expo Doctor, web export, native bundle, Docker, and security checks.
- [ ] Verify all 62 baseline routes/capabilities have an explicit replacement or intentional redirect.
- [ ] Exercise credentials and OAuth flows with documented test-provider configuration.
- [ ] Remove legacy code only after all automated parity checks pass.
- [ ] Re-run the entire release gate from a clean checkout.
- [ ] Commit, push, and complete branch handoff.
