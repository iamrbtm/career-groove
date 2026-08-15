# Docker Compose Optimization and JSON Email Import Design

## Scope

This work intentionally splits into two independent sub-projects:

1. Docker Compose optimization and database host accessibility
2. Replacement of the legacy job email parser with a JSON-only importer

The implementation phase should produce one plan per sub-project so each can be executed, reviewed, and verified independently.

## Goals

- Make PostgreSQL accessible from the LAN and persist data in `./db/data`.
- Reduce default resource usage and simplify operations by removing containerized Ollama and profile-gating non-core workers.
- Replace the existing human-readable email parsing system with a deterministic JSON-only import path based on `BEGIN_JOB_JSON` / `END_JOB_JSON`.
- Preserve the current `/applications` user flow while making imports explicit, validated, and idempotent.

## Existing State

### Docker

- `docker-compose.yml` currently runs `db`, `redis`, `app`, `document-worker`, `mobile-notification-worker`, `follow-up-worker`, `backup-scheduler`, and `ollama`.
- PostgreSQL already publishes `5432:5432`, but it uses the named volume `career_groove_data` rather than a bind mount under `./db`.
- App and worker services already support an external Ollama endpoint through `CAREER_GROOVE_OLLAMA_BASE_URL`.
- Core and worker services are all in the default stack, so plain `docker compose up` starts everything.

### Email import

- `/applications` already exposes a `Paste Email` modal via [components/tracker/tracker-page.tsx](/mnt/storage/docker/career_groove/components/tracker/tracker-page.tsx).
- The modal currently calls `POST /api/applications/parse-email`, then `POST /api/applications/preview-score`, then `POST /api/applications/bulk-create`.
- The current parser in [lib/email-match-parser.ts](/mnt/storage/docker/career_groove/lib/email-match-parser.ts) performs heuristic parsing of prose email content using numbered entries, labels, regexes, and optional AI repair.
- `bulk-create` currently inserts applications directly and does not enforce JSON-import-specific dedupe fields.

## Design A: Docker Compose Optimization

### Architecture

- Keep a single `docker-compose.yml`.
- Default stack contains only core services:
  - `db`
  - `redis`
  - `app`
- Move worker services behind a `workers` profile:
  - `document-worker`
  - `mobile-notification-worker`
  - `follow-up-worker`
  - `backup-scheduler`
- Remove the `ollama` service entirely.
- Standardize app and worker containers on host Ollama via `host.docker.internal`, using the existing `CAREER_GROOVE_OLLAMA_BASE_URL` configuration path.

### Data persistence

- Replace the Postgres named volume with a bind mount:
  - host: `./db/data`
  - container: `/var/lib/postgresql/data`
- Keep the schema bootstrap mount:
  - `./db/schema.sql:/docker-entrypoint-initdb.d/001-schema.sql:ro`
- This rollout assumes a clean database initialization. Existing data restoration, if needed, happens afterward from the backup already created outside this task.

### Networking

- Keep PostgreSQL published on `0.0.0.0:5432` for LAN access through Compose's `5432:5432` host mapping.
- Keep `app` published on `3000:3000`.
- Continue using `extra_hosts: host.docker.internal:host-gateway` where needed so containers can reach the host Ollama daemon.

### Operational model

- Core startup:
  - `docker compose up -d --build`
- Full stack startup:
  - `docker compose --profile workers up -d --build`
- Individual worker rebuild/start remains possible:
  - `docker compose --profile workers build backup-scheduler`
  - `docker compose --profile workers up -d backup-scheduler`
  - `docker compose --profile workers up -d --no-deps backup-scheduler`

### Compose cleanup

- Use shared extension blocks (`x-...`) or equivalent Compose YAML reuse for repeated environment and host settings.
- Keep health-driven startup:
  - `app` waits for healthy `db` and `redis`
  - workers wait only for the services they actually require
- Avoid needless runtime duplication of environment configuration for `DATABASE_URL`, `REDIS_URL`, and external Ollama base URL.

### Verification

- `docker compose config --quiet`
- Bring up core stack only and verify healthy startup
- Verify Postgres is reachable from the host on port `5432`
- Verify `backup-scheduler` can be rebuilt and started independently under the `workers` profile
- Verify the full worker profile can be started successfully

## Design B: JSON-Only Job Email Import

### Principle

Humans read the prose email. The application reads only the JSON block.

The only supported parsing path is:

1. locate `BEGIN_JOB_JSON`
2. locate `END_JOB_JSON`
3. extract the text between markers
4. parse JSON
5. validate schema version and payload
6. normalize supported fields
7. perform duplicate checks
8. create application records

There is no fallback to parsing human-readable content.

### Supported contract

- Top-level fields:
  - `schema_version`
  - `generated_at`
  - `search_run_date`
  - `jobs_found`
  - `jobs`
- Supported schema versions: `1.0`, `1.1`, `1.2`.
- v1.0/v1.1 entries may omit `job_description` and `raw_description_source`; both default to empty/placeholder.
- v1.2 entries include a structured `job_description` block plus a `raw_description_source` block whose `source_url` references the live posting.
- When `raw_description_source.fullTextFetchRequired = true`, Career Groove fetches the `source_url` and uses the cleaned HTML body as the application description.
- `jobs_found` must equal `jobs.length`.
- `jobs` may be empty.

### UI and route flow

- Keep the existing `/applications` modal flow.
- `POST /api/applications/parse-email` becomes a preview-only extract-and-validate endpoint.
- `POST /api/applications/preview-score` remains responsible for fit preview scoring.
- Actual creation logic moves to a shared importer service consumed by `POST /api/applications/bulk-create`.
- The modal still allows user review before creation, but every job shown in the review state must come from validated JSON, not prose extraction.

### Module structure

Replace the legacy parser with a focused module boundary that matches the current TypeScript application:

- `lib/job-email-json/extractor.ts`
  - marker finding and raw JSON extraction
- `lib/job-email-json/schema.ts`
  - Zod schemas for versioned payload validation and normalization
- `lib/job-email-json/errors.ts`
  - structured import error codes and helpers
- `lib/job-email-json/importer.ts`
  - duplicate lookup, insert behavior, and result reporting

Legacy modules to remove or replace:

- [lib/email-match-parser.ts](/mnt/storage/docker/career_groove/lib/email-match-parser.ts)
- [lib/email-match-schema.ts](/mnt/storage/docker/career_groove/lib/email-match-schema.ts)

### Validation and normalization

- Accept and store only these `work_mode` values:
  - `remote`
  - `hybrid`
  - `onsite`
- If `work_arrangement` is missing, empty, or invalid, normalize to `remote`.
- Do not inspect prose to infer or repair any field.
- Consume salary from structured JSON only:
  - `salary.min`
  - `salary.max`
  - `salary.currency`
  - `salary.period`
  - `salary.raw`
- Never parse salary from `salary.raw`.
- Consume dates only from JSON:
  - `posting_date`
  - `posting_date_text`
  - `discovered_date`
  - `search_run_date`
  - `generated_at`

### Error model

The importer should return structured failures for cases such as:

- `JOB_JSON_MARKERS_NOT_FOUND`
- `JOB_JSON_END_MARKER_MISSING`
- `JOB_JSON_EMPTY`
- `JOB_JSON_INVALID`
- `JOB_JSON_SCHEMA_UNSUPPORTED`
- `JOB_JSON_VALIDATION_FAILED`
- `JOB_JSON_DUPLICATE`
- `JOB_JSON_IMPORT_FAILED`

These failures must not trigger a fallback parser, AI repair, or partial creative import.

### Duplicate handling

Primary duplicate key:

- `dedupe_key`

Importer duplicate checks:

1. `(user_id, dedupe_key)`
2. `source_job_id` when present
3. `canonical_url` when present

The importer must be idempotent:

- first import of a payload may create records
- repeated import of the same payload must skip duplicates rather than creating new application rows

Database uniqueness should enforce the most stable duplicate path where possible so race conditions degrade into safe duplicate skips instead of fatal corruption.

### Database design

Reuse the existing `applications` table and add only the fields needed to support the JSON contract cleanly:

- `dedupe_key`
- `source_job_id`
- `canonical_url`
- `posting_date`
- `posting_date_text`
- `discovered_date`
- `salary_period`
- `salary_raw`
- `search_run_date`

Reuse existing columns where semantics already match:

- `title`
- `company`
- `location`
- `work_mode`
- `salary_min`
- `salary_max`
- `salary_currency`
- `source_url` for `apply_url`

Add a unique index on `(user_id, dedupe_key)` where `dedupe_key IS NOT NULL`.

Use `applications.metadata` for secondary import context only, not as the primary storage for dedupe-critical fields.

### Record creation behavior

- Imports still create `applications` rows rather than a separate imported-jobs table.
- `bulk-create` should call a shared importer instead of embedding all insert logic inline.
- Insert behavior should continue creating an `application_events` row for successful imports.
- Existing scoring/research hooks may continue, but they must operate on validated JSON-derived data only.

### Testing

Required test coverage includes:

- successful extraction between markers
- misleading prose above the JSON block is ignored
- missing start marker
- missing end marker
- malformed JSON
- unsupported version
- invalid salary types
- valid null salary payload
- work arrangement normalization and accepted values
- `jobs_found` mismatch
- duplicate import idempotency
- duplicate via `source_job_id`
- duplicate via `canonical_url`
- multi-job payload import
- JSON strings containing quotes, apostrophes, Unicode, and query-parameter URLs

Obsolete tests that only validate human-readable parsing behavior should be removed or rewritten.

### Documentation

Update project documentation to state clearly:

- supported contract is prose email plus appended JSON markers
- current supported schema version is `1.0`
- no JSON means no import
- invalid JSON means no import
- no prose fallback exists
- duplicates are skipped

## Implementation decomposition

This design should become two separate implementation plans:

1. Docker Compose optimization plan
2. JSON email import replacement plan

That keeps the infrastructure and application import changes independently testable and easier to review.

## Spec self-review

- Placeholder scan: no `TODO`, `TBD`, or deferred requirements remain.
- Internal consistency: Docker and importer work are separated deliberately; importer contract uses JSON only and does not depend on prose parsing.
- Scope check: implementation should be split into two plans even though both designs live in this one spec.
- Ambiguity check: `work_arrangement` normalization is explicitly defined as defaulting invalid/missing values to `remote`.
