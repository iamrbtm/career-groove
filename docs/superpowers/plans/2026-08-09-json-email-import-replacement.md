# JSON Email Import Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the prose email parser with a JSON-only importer that reads `BEGIN_JOB_JSON` / `END_JOB_JSON`, validates schema version `1.0`, prevents duplicates, stores import metadata on `applications`, and preserves the current `/applications` modal workflow.

**Architecture:** Build a small `lib/job-email-json` module that owns marker extraction, payload validation, normalization, and import orchestration. Keep `POST /api/applications/parse-email` as a preview endpoint and move duplicate-aware creation into a shared importer used by `bulk-create`. Remove the legacy parser and its fallback behavior entirely.

**Tech Stack:** Next.js route handlers, TypeScript, Zod, PostgreSQL, SQL migrations, Node 22 `node:test` runner via `tsx`, Tailwind/React modal UI

## Global Constraints

- The application must read only the JSON between `BEGIN_JOB_JSON` and `END_JOB_JSON`.
- No human-readable fallback parsing may remain in the email import path.
- Supported schema version is only `1.0`.
- `jobs_found` must equal `jobs.length`.
- Stored `work_mode` values are only `remote`, `hybrid`, and `onsite`; missing or invalid `work_arrangement` normalizes to `remote`.
- Salary values must come from structured JSON fields, not reparsed prose.
- Duplicate prevention must use `dedupe_key` first, then `source_job_id`, then `canonical_url`.
- The implementation must reuse the existing `applications` table rather than creating a parallel imported-jobs table.

---

### Task 1: Add Test Harness and Failing JSON-Only Parser Tests

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `tests/job-email-json/extractor.test.ts`
- Create: `tests/job-email-json/schema.test.ts`
- Create: `tests/job-email-json/fixtures.ts`

**Interfaces:**
- Consumes: the approved JSON email contract and schema version `1.0`
- Produces: `npm run test:job-email` executing pure TypeScript tests through `node --import tsx --test`

- [ ] **Step 1: Add direct test scripts for the new importer tests**

```json
{
  "scripts": {
    "test": "node --import tsx --test tests/**/*.test.ts",
    "test:job-email": "node --import tsx --test tests/job-email-json/**/*.test.ts"
  },
  "devDependencies": {
    "tsx": "^4.8.1"
  }
}
```

- [ ] **Step 2: Write failing extractor and schema tests against non-existent modules**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { extractJobJson } from "@/lib/job-email-json/extractor";
import { parseJobEmailPayload } from "@/lib/job-email-json/schema";
import { validEmailBody, invalidJobsFoundBody, proseTrapBody } from "./fixtures";

test("extracts JSON between markers", () => {
  assert.match(extractJobJson(validEmailBody), /^\{/);
});

test("ignores misleading prose outside the JSON block", () => {
  const payload = parseJobEmailPayload(extractJobJson(proseTrapBody));
  assert.equal(payload.jobs[0].location, "United States");
  assert.equal(payload.jobs[0].salary.min, 53550);
});

test("rejects jobs_found mismatch", () => {
  assert.throws(() => parseJobEmailPayload(extractJobJson(invalidJobsFoundBody)));
});
```

- [ ] **Step 3: Run the tests to confirm they fail before implementation**

Run: `npm run test:job-email`

Expected: FAIL with module resolution errors for `@/lib/job-email-json/*` or missing exports.

- [ ] **Step 4: Add fixture coverage for missing markers, malformed JSON, unsupported version, and invalid work arrangement**

```ts
export const missingMarkerBody = "Jeremy,\nNo machine-readable payload today.";
export const malformedJsonBody = "BEGIN_JOB_JSON\n{\"schema_version\":\"1.0\", bad }\nEND_JOB_JSON";
export const unsupportedVersionBody = "BEGIN_JOB_JSON\n{\"schema_version\":\"2.0\",\"generated_at\":null,\"search_run_date\":null,\"jobs_found\":0,\"jobs\":[]}\nEND_JOB_JSON";
export const invalidWorkArrangementBody = "BEGIN_JOB_JSON\n{\"schema_version\":\"1.0\",\"generated_at\":null,\"search_run_date\":\"2026-08-09\",\"jobs_found\":1,\"jobs\":[{\"job_id\":\"ripple\",\"dedupe_key\":\"38481670bcadac7c953e4ae0e0225b6b064d41ac8bfa17636f757204b68f428b\",\"title\":\"Implementation Specialist\",\"company\":\"Rippling\",\"location\":\"United States\",\"work_arrangement\":\"not_specified\",\"posting_date\":null,\"posting_date_text\":null,\"discovered_date\":\"2026-08-09\",\"salary\":{\"min\":null,\"max\":null,\"currency\":\"USD\",\"period\":\"unknown\",\"raw\":\"Not listed\"},\"why_match\":\"Strong fit\",\"notable_gaps\":\"None\",\"apply_url\":\"https://example.com/job\",\"canonical_url\":null,\"source_job_id\":null}]}\nEND_JOB_JSON";
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tests/job-email-json
git commit -m "test: add failing job email json parser tests"
```

### Task 2: Implement JSON Extraction, Validation, and Preview Route

**Files:**
- Create: `lib/job-email-json/errors.ts`
- Create: `lib/job-email-json/extractor.ts`
- Create: `lib/job-email-json/schema.ts`
- Modify: `app/api/applications/parse-email/route.ts`
- Modify: `components/tracker/email-import-modal.tsx`
- Delete: `lib/email-match-parser.ts`
- Delete: `lib/email-match-schema.ts`

**Interfaces:**
- Consumes: `npm run test:job-email` from Task 1 and the existing `/applications` modal preview flow
- Produces: `extractJobJson(emailBody: string): string` and `parseJobEmailPayload(jsonText: string): ParsedJobEmailPayload`

- [ ] **Step 1: Implement structured importer errors**

```ts
export class JobEmailImportError extends Error {
  constructor(
    public readonly code:
      | "JOB_JSON_MARKERS_NOT_FOUND"
      | "JOB_JSON_END_MARKER_MISSING"
      | "JOB_JSON_EMPTY"
      | "JOB_JSON_INVALID"
      | "JOB_JSON_SCHEMA_UNSUPPORTED"
      | "JOB_JSON_VALIDATION_FAILED",
    message: string,
  ) {
    super(message);
  }
}
```

- [ ] **Step 2: Implement marker extraction and schema parsing**

```ts
const START_MARKER = "BEGIN_JOB_JSON";
const END_MARKER = "END_JOB_JSON";

export function extractJobJson(emailBody: string): string {
  const start = emailBody.indexOf(START_MARKER);
  const end = emailBody.indexOf(END_MARKER);
  if (start < 0) throw new JobEmailImportError("JOB_JSON_MARKERS_NOT_FOUND", "No JSON block markers were found.");
  if (end < 0) throw new JobEmailImportError("JOB_JSON_END_MARKER_MISSING", "The job JSON end marker is missing.");
  if (end <= start) throw new JobEmailImportError("JOB_JSON_INVALID", "The job JSON markers are out of order.");
  const jsonText = emailBody.slice(start + START_MARKER.length, end).trim();
  if (!jsonText) throw new JobEmailImportError("JOB_JSON_EMPTY", "The job JSON block is empty.");
  return jsonText;
}
```

```ts
const jobSchema = z.object({
  job_id: z.string().min(1),
  dedupe_key: z.string().regex(/^[a-f0-9]{64}$/),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().min(1),
  work_arrangement: z.string().transform((value) => (
    value === "hybrid" || value === "onsite" ? value : "remote"
  )),
  salary: z.object({
    min: z.number().nullable(),
    max: z.number().nullable(),
    currency: z.literal("USD"),
    period: z.enum(["hour", "year", "unknown"]),
    raw: z.string().nullable(),
  }),
});
```

- [ ] **Step 3: Refactor `parse-email` to preview only JSON-derived jobs**

```ts
const parsed = parseEmailImportInput.safeParse(await request.json().catch(() => null));
const jsonText = extractJobJson(parsed.data.text);
const payload = parseJobEmailPayload(jsonText);

return Response.json({
  header: payload.generated_at,
  footer: payload.search_run_date,
  jobs: payload.jobs.map((job) => ({
    jobId: job.job_id,
    dedupeKey: job.dedupe_key,
    title: job.title,
    company: job.company,
    location: job.location,
    workArrangement: job.work_arrangement,
    postingDate: job.posting_date,
    postingDateText: job.posting_date_text,
    discoveredDate: job.discovered_date,
    salary: job.salary,
    whyMatch: job.why_match,
    notableGaps: job.notable_gaps,
    applyUrl: job.apply_url,
    canonicalUrl: job.canonical_url,
    sourceJobId: job.source_job_id,
  })),
  warnings: [],
});
```

- [ ] **Step 4: Update the modal to consume the new JSON job shape and rerun parser tests**

```ts
type ParsedJobEntry = {
  jobId: string;
  dedupeKey: string;
  title: string;
  company: string;
  location: string;
  workArrangement: "remote" | "hybrid" | "onsite";
  postingDate: string | null;
  postingDateText: string | null;
  discoveredDate: string | null;
  salary: { min: number | null; max: number | null; currency: "USD"; period: "hour" | "year" | "unknown"; raw: string | null };
  whyMatch: string;
  notableGaps: string;
  applyUrl: string;
  canonicalUrl: string | null;
  sourceJobId: string | null;
};
```

Run: `npm run test:job-email`

Expected: PASS for extractor/schema tests; the legacy parser files are no longer referenced by the preview path.

- [ ] **Step 5: Commit**

```bash
git add app/api/applications/parse-email/route.ts components/tracker/email-import-modal.tsx lib/job-email-json
git rm lib/email-match-parser.ts lib/email-match-schema.ts
git commit -m "feat: replace email preview parser with json extractor"
```

### Task 3: Add Import Columns, Shared Importer, and Duplicate Tests

**Files:**
- Modify: `db/schema.sql`
- Create: `db/migrations/019_job_email_json_import.sql`
- Modify: `lib/application-schema.ts`
- Create: `lib/job-email-json/importer.ts`
- Create: `tests/job-email-json/importer.test.ts`
- Create: `tests/job-email-json/importer-db.test.ts`
- Create: `tests/job-email-json/importer-db.test-helpers.ts`

**Interfaces:**
- Consumes: `ParsedJobEmailPayload` from Task 2 and the existing `applications` table
- Produces: `importJobEmailEntries(client, userId, entries): { jobsReceived: number; jobsCreated: number; duplicatesSkipped: number; jobsFailed: number; jobs: Array<{ jobId: string; status: "created" | "duplicate" | "failed"; reason?: string }> }`

- [ ] **Step 1: Write failing importer tests for duplicates and idempotency**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { importJobEmailEntries } from "@/lib/job-email-json/importer";
import { makeDbClient, seedUser, validPayload } from "./importer-db.test-helpers";

test("second import skips duplicates by dedupe_key", async () => {
  const client = await makeDbClient();
  const userId = await seedUser(client);
  const first = await importJobEmailEntries(client, userId, validPayload.jobs, { searchRunDate: validPayload.search_run_date });
  const second = await importJobEmailEntries(client, userId, validPayload.jobs, { searchRunDate: validPayload.search_run_date });
  assert.equal(first.jobsCreated, 1);
  assert.equal(second.jobsCreated, 0);
  assert.equal(second.duplicatesSkipped, 1);
});
```

- [ ] **Step 2: Add schema and migration support for JSON import metadata**

```sql
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
  ADD COLUMN IF NOT EXISTS source_job_id TEXT,
  ADD COLUMN IF NOT EXISTS canonical_url TEXT,
  ADD COLUMN IF NOT EXISTS posting_date DATE,
  ADD COLUMN IF NOT EXISTS posting_date_text TEXT,
  ADD COLUMN IF NOT EXISTS discovered_date DATE,
  ADD COLUMN IF NOT EXISTS salary_period TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS salary_raw TEXT,
  ADD COLUMN IF NOT EXISTS search_run_date DATE;

ALTER TABLE applications
  ADD CONSTRAINT applications_salary_period_check
  CHECK (salary_period IN ('hour','year','unknown'));

CREATE UNIQUE INDEX IF NOT EXISTS applications_user_dedupe_key_idx
  ON applications(user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
```

- [ ] **Step 3: Implement a shared importer that checks duplicates before insert and tolerates uniqueness races**

```ts
const existing = await client.query(
  `SELECT id FROM applications
   WHERE user_id = $1
     AND (
       (dedupe_key IS NOT NULL AND dedupe_key = $2)
       OR ($3::text IS NOT NULL AND source_job_id = $3 AND lower(company) = lower($4))
       OR ($5::text IS NOT NULL AND canonical_url = $5)
     )
   LIMIT 1`,
  [userId, job.dedupe_key, job.source_job_id, job.company, job.canonical_url],
);
if (existing.rowCount) return { status: "duplicate" as const };
```

```ts
const created = await client.query(
  `INSERT INTO applications (
     user_id, title, company, location, work_mode, salary_min, salary_max, salary_currency,
     salary_period, salary_raw, source_url, canonical_url, source_job_id, dedupe_key,
     posting_date, posting_date_text, discovered_date, search_run_date,
     description, notes, source, metadata
   ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::jsonb)`,
  [
    userId,
    job.title,
    job.company,
    job.location,
    job.workMode,
    job.salaryMin,
    job.salaryMax,
    job.salaryCurrency,
    job.salaryPeriod,
    job.salaryRaw,
    job.sourceUrl,
    job.canonicalUrl,
    job.sourceJobId,
    job.dedupeKey,
    job.postingDate,
    job.postingDateText,
    job.discoveredDate,
    options.searchRunDate,
    job.description,
    job.notes,
    "email_json_import",
    JSON.stringify({ jobId: job.jobId, whyMatch: job.whyMatch, notableGaps: job.notableGaps }),
  ],
);
```

- [ ] **Step 4: Run the importer tests against a real local Postgres**

Run:

```bash
docker compose up -d db
DATABASE_URL=postgresql://career_groove:career_groove@127.0.0.1:5432/career_groove node --import tsx --test tests/job-email-json/importer*.test.ts
```

Expected: FAIL before implementation, then PASS after the migration and importer land.

- [ ] **Step 5: Commit**

```bash
git add db/schema.sql db/migrations/019_job_email_json_import.sql lib/application-schema.ts lib/job-email-json/importer.ts tests/job-email-json/importer*.test.ts
git commit -m "feat: add duplicate-safe job email importer"
```

### Task 4: Refactor Bulk Create, Remove Legacy Paths, and Verify End-to-End

**Files:**
- Modify: `app/api/applications/bulk-create/route.ts`
- Modify: `README.md`
- Modify: `components/tracker/email-import-modal.tsx`
- Modify: `tests/job-email-json/schema.test.ts`

**Interfaces:**
- Consumes: shared importer and migration work from Task 3
- Produces: `/applications` email import flow that creates applications only from validated JSON payloads

- [ ] **Step 1: Define a dedicated bulk-import input schema for JSON email entries**

```ts
const bulkImportEntrySchema = z.object({
  jobId: z.string().min(1),
  dedupeKey: z.string().regex(/^[a-f0-9]{64}$/),
  title: z.string().trim().min(1).max(200),
  company: z.string().trim().min(1).max(200),
  location: z.string().trim().min(1).max(200),
  workMode: z.enum(["remote", "hybrid", "onsite"]),
  salaryMin: z.number().int().min(0).nullable(),
  salaryMax: z.number().int().min(0).nullable(),
  salaryCurrency: z.literal("USD"),
  salaryPeriod: z.enum(["hour", "year", "unknown"]),
  salaryRaw: z.string().nullable(),
  sourceUrl: z.string().url(),
  canonicalUrl: z.string().url().nullable(),
  sourceJobId: z.string().nullable(),
  postingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  postingDateText: z.string().nullable(),
  discoveredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  whyMatch: z.string(),
  notableGaps: z.string(),
  description: z.string().min(1).max(50000),
  notes: z.string().max(20000).nullable(),
});

const inputSchema = z.object({
  searchRunDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  entries: z.array(bulkImportEntrySchema).min(1).max(50),
});
```

- [ ] **Step 2: Replace inline inserts in `bulk-create` with the shared importer and structured results**

```ts
const result = await importJobEmailEntries(client, user, parsed.data.entries, {
  searchRunDate: parsed.data.searchRunDate ?? null,
});
return Response.json(result, { status: 201 });
```

- [ ] **Step 3: Remove obsolete prose-parser tests and update documentation**

```md
## Job email import

CareerGroove imports jobs only from the JSON block appended to an email:

BEGIN_JOB_JSON
{"schema_version":"1.0","generated_at":"2026-08-09T12:00:00-07:00","search_run_date":"2026-08-09","jobs_found":1,"jobs":[{"job_id":"rippling-implementation-specialist-platform","dedupe_key":"38481670bcadac7c953e4ae0e0225b6b064d41ac8bfa17636f757204b68f428b","title":"Implementation Specialist, Platform","company":"Rippling","location":"United States","work_arrangement":"remote","posting_date":null,"posting_date_text":"Current active posting; exact posting date not shown","discovered_date":"2026-08-09","salary":{"min":53550,"max":89775,"currency":"USD","period":"year","raw":"$53,550-$89,775 depending on U.S. location tier"},"why_match":"Strong implementation and workflow fit.","notable_gaps":"Requests SaaS implementation experience.","apply_url":"https://example.com/job","canonical_url":"https://example.com/job","source_job_id":"12345"}]}
END_JOB_JSON

No JSON means no import. Invalid JSON means no import. The prose portion of the email is for the human reader only.
```

```bash
rg -n 'email-match-parser|parse numbered|Why it matches:|Notable gaps:' tests lib app
```

Expected: no remaining parser-specific compatibility tests or prose extraction helpers in the email import path.

- [ ] **Step 4: Run the full verification set**

Run:

```bash
npm run test:job-email
DATABASE_URL=postgresql://career_groove:career_groove@127.0.0.1:5432/career_groove node --import tsx --test tests/job-email-json/importer*.test.ts
npm run typecheck
docker compose up -d --build
```

Expected: PASS. The `/applications` import flow is wired to the JSON-only path, legacy parser files are gone, and no prose parsing remains in the job email import path.

- [ ] **Step 5: Commit**

```bash
git add app/api/applications/bulk-create/route.ts components/tracker/email-import-modal.tsx README.md tests/job-email-json
git commit -m "feat: complete json-only job email import flow"
```
