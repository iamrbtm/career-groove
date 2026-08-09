# Docker Compose Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework Docker Compose so the default stack is lighter, PostgreSQL persists to `./db/data`, PostgreSQL is reachable on the LAN, and host Ollama replaces the Compose Ollama service.

**Architecture:** Keep a single `docker-compose.yml`, but split the runtime into always-on core services (`db`, `redis`, `app`) and opt-in worker services behind a `workers` profile. Replace the Postgres named volume with a repo-local bind mount, remove the `ollama` service, centralize repeated Compose settings, and document the new operational commands.

**Tech Stack:** Docker Compose, PostgreSQL 17 Alpine, Redis 7 Alpine, Next.js standalone container, shell verification commands, Markdown docs

## Global Constraints

- PostgreSQL data must bind-mount to `./db/data`.
- PostgreSQL must stay reachable from other machines on the LAN via host port `5432`.
- The application stack must use a host Ollama daemon through `host.docker.internal`.
- Default `docker compose up -d --build` should start only `db`, `redis`, and `app`.
- `document-worker`, `mobile-notification-worker`, `follow-up-worker`, and `backup-scheduler` must be behind a `workers` profile.
- The plan must preserve the existing backup scheduler behavior while allowing `backup-scheduler` to be rebuilt and started independently.

---

### Task 1: Refactor Core Compose Layout

**Files:**
- Create: `db/data/.gitignore`
- Create: `scripts/verify-compose-layout.sh`
- Modify: `docker-compose.yml`

**Interfaces:**
- Consumes: existing `docker-compose.yml` service definitions and current `CAREER_GROOVE_OLLAMA_BASE_URL` env flow
- Produces: `scripts/verify-compose-layout.sh` returning exit code `0` when the Compose layout matches the new contract

- [ ] **Step 1: Write the failing layout verification script**

```bash
#!/usr/bin/env bash
set -euo pipefail

tmp="$(mktemp)"
docker compose config > "$tmp"

rg -q '\./db/data:/var/lib/postgresql/data' "$tmp"
! rg -q '^  ollama:$' "$tmp"
rg -q 'host\.docker\.internal:host-gateway' "$tmp"
rg -q 'CAREER_GROOVE_OLLAMA_BASE_URL:-http://host\.docker\.internal:11434' "$tmp"
```

- [ ] **Step 2: Run the script to verify the current layout fails**

Run: `bash scripts/verify-compose-layout.sh`

Expected: FAIL because the current Compose file still uses the named Postgres volume, still declares `ollama`, and does not profile-gate worker services.

- [ ] **Step 3: Replace the named Postgres volume, remove `ollama`, and add repo-safe DB data ignores**

```yaml
x-app-env: &app-env
  DATABASE_URL: postgresql://career_groove:career_groove@db:5432/career_groove
  REDIS_URL: redis://redis:6379
  OLLAMA_BASE_URL: ${CAREER_GROOVE_OLLAMA_BASE_URL:-http://host.docker.internal:11434}

services:
  db:
    volumes:
      - ./db/data:/var/lib/postgresql/data
      - ./db/schema.sql:/docker-entrypoint-initdb.d/001-schema.sql:ro

  app:
    environment: *app-env
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

```gitignore
*
!.gitignore
```

- [ ] **Step 4: Re-run the layout verification script**

Run: `bash scripts/verify-compose-layout.sh`

Expected: PASS for the core layout assertions that do not depend on worker profiles yet.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml db/data/.gitignore scripts/verify-compose-layout.sh
git commit -m "infra: refactor compose core services"
```

### Task 2: Move Workers Behind Profiles and Update Runtime Docs

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Consumes: the core Compose refactor from Task 1
- Produces: a `workers` profile contract with documented startup commands for core-only, full-stack, and one-off worker operation

- [ ] **Step 1: Extend the verification script with worker profile checks and confirm it fails**

```bash
cat <<'EOF' >> scripts/verify-compose-layout.sh
rg -q 'document-worker:' "$tmp"
rg -q 'mobile-notification-worker:' "$tmp"
rg -q 'follow-up-worker:' "$tmp"
rg -q 'backup-scheduler:' "$tmp"
rg -q 'profiles:\n\s+- workers' "$tmp"
EOF

bash scripts/verify-compose-layout.sh
```

Expected: FAIL because the worker services are not yet behind `profiles: [workers]`.

- [ ] **Step 2: Add `profiles: ["workers"]` to all worker services and tighten their dependencies**

```yaml
  document-worker:
    profiles: ["workers"]
    environment:
      <<: *app-env
    depends_on:
      db: { condition: service_healthy }
      redis: { condition: service_healthy }

  backup-scheduler:
    profiles: ["workers"]
    depends_on:
      db: { condition: service_healthy }
```

- [ ] **Step 3: Rewrite environment and README guidance for host Ollama and worker profiles**

```dotenv
# CareerGroove uses a host Ollama daemon from containers via host.docker.internal.
# Configure the host daemon to listen on 0.0.0.0:11434.
CAREER_GROOVE_OLLAMA_BASE_URL=http://host.docker.internal:11434
```

```md
## Run with Docker

    cp .env.example .env
    docker compose up -d --build
    docker compose --profile workers up -d --build

To rebuild only the backup scheduler:

    docker compose --profile workers build backup-scheduler
    docker compose --profile workers up -d --no-deps backup-scheduler
```

- [ ] **Step 4: Verify the profiled layout**

Run: `bash scripts/verify-compose-layout.sh`

Expected: PASS with worker profile assertions satisfied and no `ollama` service remaining.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml .env.example README.md
git commit -m "infra: profile-gate compose workers"
```

### Task 3: Run Full Compose Verification

**Files:**
- Test: `docker-compose.yml`
- Test: `README.md`

**Interfaces:**
- Consumes: the final Compose layout and documentation from Tasks 1-2
- Produces: verified startup commands and evidence that the database and targeted worker operations behave as designed

- [ ] **Step 1: Validate the final Compose file**

```bash
docker compose config --quiet
```

Expected: PASS with no schema or interpolation errors.

- [ ] **Step 2: Start the core stack and verify container health**

```bash
docker compose up -d --build
docker compose ps
```

Expected: `db`, `redis`, and `app` are up; worker services are not started by default.

- [ ] **Step 3: Verify PostgreSQL host accessibility on port `5432`**

```bash
pg_isready -h 127.0.0.1 -p 5432 -U career_groove -d career_groove
```

Expected: `accepting connections`

- [ ] **Step 4: Verify targeted worker rebuild/start for `backup-scheduler`**

```bash
docker compose --profile workers build backup-scheduler
docker compose --profile workers up -d --no-deps backup-scheduler
docker compose ps backup-scheduler
```

Expected: `backup-scheduler` starts independently without forcing unrelated workers up.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml .env.example README.md db/data/.gitignore scripts/verify-compose-layout.sh
git commit -m "infra: verify compose runtime workflow"
```
