# Plan: Email Import Scoring Fidelity Fix

**Generated**: 2026-08-15
**Estimated Complexity**: Low–Medium
**Sprints**: 2

## Overview

Pasting a "Daily Job Matches" email into the Tracker Studio produces applications with materially lower fit scores than the same role captured manually via the `CaptureModal`. Manual capture wins because it sends a rich `description` (full scraped posting body) to the deterministic scorer in `lib/tracker-studio.ts:computeScore()`, while email import sends the `job.whyItMatches` summary plus a thin `job.rawText.slice(0, 2000)` slice.

The scoring is keyword/token based, not LLM-based, so the only fix is to make the `description` field on email-imported applications as rich as what manual capture produces.

### Approach

1. **Default `enrich` to `true`** in the modal's `parse-email` call so each job's `applyUrl` is fetched by `researchUrl()` and the cleaned HTML body becomes `job.description`.
2. **Improve URL enrichment resilience** by trying alternative URLs (strip/add `www.`, swap HTTP→HTTPS, retry once on 4xx) before giving up.
3. **Widen the email-side description fallback** so even when the URL fetch fails, the description is the union of `whyItMatches + notableGaps + rawText` (already inside the email body), not a single 150-char summary.
4. **Cap fallback description** at a maximum length and re-run `parseJobPost()` on it to extract a canonical summary, ensuring no fabricated/bloated text reaches the scorer.

### Guardrails (user concern)

- Scorer must NOT over-reward thin inputs vs. what a manual paste produces. Test must confirm: when the same posting is (a) fetched & parsed, (b) available only as email summary, the resulting fit score for (b) is ≤ (a) and within a 5-pt band.
- URL fetches are slow and unreliable. Default `enrich` is best-effort — failures must continue silently and surface in the existing warnings banner, not break the modal.
- Length cap on the fallback description keeps the email-only path from "feeling longer" without actually containing more skill-relevant keywords.

---

## Prerequisites

- No new dependencies.
- Existing `researchUrl()` in `lib/research.ts` (HTTP fetcher with Cloudflare bypass + 12s timeout) is reused.
- The bulk-create path (`app/api/applications/bulk-create/route.ts:91-99`) already fires `autoResearchApplication` asynchronously after creation, but it writes to `metadata.autoResearch` rather than updating `description`. That path is left alone.

---

## Sprint 1: Score Description Quality for Email Imports

**Goal**: Make `description` on email-imported applications match what a manually captured role would have, by enabling URL enrichment by default and widening the email fallback.

**Demo/Validation**:
- Paste a fresh Daily Job Matches email → modal shows parsed cards → confirm → check the DB: each `applications.description` row is ≥800 chars for jobs with a reachable Apply URL.
- For an email with a dead Apply URL, the description is still ≥400 chars (the enriched concatenation of whyItMatches + notableGaps + rawText, parsed by `parseJobPost` and limited).
- Manually paste the same job into CaptureModal — observe the resulting fit score is within 5 points of the email-imported version's score, and never lower.

### Task 1.1: Flip enrichment default and harden URL fetch
- **Location**: `app/api/applications/parse-email/route.ts`, `components/tracker/email-import-modal.tsx`
- **Description**:
  - Change modal fetch at `email-import-modal.tsx:120-124` to send `{ text, enrich: true }` instead of `enrich: false`.
  - In the API route's enrichment loop (`parse-email/route.ts:28-43`), keep current `Promise.race` with 15s timeout but add a retry helper `enrichWithRetries(applyUrl)`.
  - The helper tries the URL as-is, then retries with `https` swapped for `http` or vice versa, then retries with `www.` stripped or added. Track outcome (`'fetched' | 'cloudflare' | 'http-error' | 'timeout' | 'no-url'`).
  - On `'fetched'`: use `research.rawJobText` as `description`, same as today.
  - On anything else: do NOT mark the job as `enrichmentSource: null` directly — let it fall through to Task 1.2.
- **Dependencies**: None
- **Acceptance Criteria**:
  - `enrich: true` is the default for modal callers (the `enrich` flag still overrides if a caller passes false explicitly).
  - `enrichWithRetries()` returns one of the five outcome statuses; logs the rejection reason for diagnostics but never throws.
  - Existing Cloudflare fallback inside `researchUrl()` is left in place — it operates on HTML response content, not URL form.
- **Validation**:
  - Manual: paste an email with `lever.co` and `greenhouse.io` Apply URLs → confirm fetched descriptions populated.
  - Manual: paste an email with a 404 Apply URL → modal still completes, warnings show "1 of N URLs unreachable".

### Task 1.2: Widen email-only fallback description
- **Location**: `components/tracker/email-import-modal.tsx`
- **Description**:
  - Replace the `description` fallback chain at lines 148 and 193:
    ```ts
    description: job.description
      || [job.whyItMatches, job.notableGaps, job.rawText].filter(Boolean).join("\n\n").slice(0, 5000)
    ```
  - Order matters: real scraped body wins; concatenated email body is the fallback. Cap at 5000 chars to avoid writing huge text.
- **Dependencies**: None
- **Acceptance Criteria**:
  - When `job.description` is empty (URL unreachable or not enriched), fallback produces ≥400 chars for typical Daily Job Matches entries.
  - The capped fallback still satisfies the modal/DB NOT NULL constraint.
  - `notes` field is unchanged (still contains the labeled metadata).
- **Validation**:
  - Inspect the resulting `applications.description` after import — match expected character count per scenario.

### Task 1.3: Add a length-aware description normalizer
- **Location**: `lib/email-match-parser.ts` (new export)
- **Description**: New exported function `normalizeDescription(text: string): string` that:
  - Trims whitespace, collapses runs of blank lines.
  - If `text.length > 4000`, trims to first 4000 chars at a sentence boundary (look back from position 4000 for the last `.` or `\n\n`).
  - Strips obvious nav/menu boilerplate lines (lines shorter than 40 chars and starting with verbs like "Apply", "Save", "Share", "Back to", "Sign in").
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Function is pure (no side effects), exported for reuse from Task 1.4.
  - 4000-char cap matches what the existing `parseJobPost()` description flow uses internally.
- **Validation**:
  - Unit-style smoke test: pass a 6000-char email summary, confirm output is 3500-4000 chars, sentence boundary respected.

### Task 1.4: Use the normalizer in both scoring and creation paths
- **Location**: `components/tracker/email-import-modal.tsx`
- **Description**: Wrap the description construction in `handleParse` (line 148) and `handleCreate` (line 193) with the new `normalizeDescription()`. Import it from `@/lib/email-match-parser`.
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - Both call sites use the same normalizer; behavior is consistent across the preview-score path and the bulk-create path.
- **Validation**:
  - DevTools network tab: confirm identical `description` text appears in both the `/api/applications/preview-score` request body and the `/api/applications/bulk-create` request body for any given job card.

---

## Sprint 2: Score-Fidelity Verification

**Goal**: Prove email-imported scores land in the same band as manually captured scores, and add a regression check that no path is inflating fit beyond the manual baseline.

**Demo/Validation**:
- Spot-check: paste one fresh Daily Job Matches email → confirm fit scores. Then delete each application and re-create them manually via CaptureModal with the actual posting URL → confirm scores are within 5 pts and not lower.
- For unreachable URLs: the email-imported score should be ≥ the score you'd get pasting only "whyItMatches" alone.

### Task 2.1: Add `descriptionLength` debugging to scorer context snapshot
- **Location**: `lib/tracker-studio.ts` (`computeScore()` function, around line 362)
- **Description**: Add the `descriptionLength` and `descriptionSource` (`'scraped' | 'email-fallback' | 'manual'`) into `contextSnapshot.contextSnapshot` for scoring runs.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `contextSnapshot` includes `descriptionLength: number` and `descriptionSource: 'scraped' | 'email-fallback' | 'unknown'`.
  - The 'manual' / 'scraped' / 'email-fallback' distinction is set in the caller (the modal) before sending to the scorer, via a `metadata: { descriptionSource }` field on the preview-score entry.
- **Validation**:
  - Inspect `application_scores.context_snapshot` JSON in DB after a paste-email flow — confirm field present and correct value.

### Task 2.2: Mark description source on the request body
- **Location**: `components/tracker/email-import-modal.tsx`
- **Description**: When building the `description` field in `handleParse` and `handleCreate`, attach the source label and pass it via a new optional `descriptionSource` field on the entry object. The preview-score and bulk-create schemas are extended to accept this field (whitelisted but ignored for storage).
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Preview-score schema accepts `descriptionSource` but does not store it.
  - Bulk-create route accepts and forwards it to `metadata.importedDescriptionSource` on the application row.
- **Validation**:
  - After creation, `applications.metadata.importedDescriptionSource` reflects what was passed.

### Task 2.3: Write a one-shot scoring parity script
- **Location**: `scripts/score-parity-check.mjs`
- **Description**: New standalone Node script (no Next.js runtime needed) that:
  - Loads a sample email (provided by user, base64-encoded in the script header).
  - Calls `parseJobMatchEmail` to produce entries.
  - For each entry with a reachable Apply URL, calls `researchUrl` and produces two description strings: `scraped` (from `rawJobText`) and `emailFallback` (`whyItMatches + notableGaps + rawText` concatenated, normalized via Task 1.3).
  - For each pair, calls `computeScore()` (or a pure scoring function exported from `lib/tracker-studio.ts`) with the user's saved context.
  - Prints a side-by-side score table to stdout: title, scraped_fit, email_fallback_fit, delta.
  - Exits non-zero if any delta is > 15 points in either direction.
- **Dependencies**: Task 2.1, Task 2.2
- **Acceptance Criteria**:
  - Script runs cleanly with `node scripts/score-parity-check.mjs`.
  - Output is human-readable (table or aligned columns).
  - Both directions are checked: scraped≥email-fallback+15 is a fail (over-reward), email-fallback>scraped+5 is a fail (wonky asymmetry the other way).
- **Validation**:
  - Run the script with a user-supplied email; verify both directions hold.

---

## Testing Strategy

| Sprint | What to Test | How |
|--------|-------------|-----|
| 1 | Description length after import | DB query: `SELECT LENGTH(description), LENGTH(notes) FROM applications WHERE source='email' ORDER BY created_at DESC LIMIT 10;` |
| 1 | URL fetch resilience | curl reachable + 404 + Cloudflare-blocked URLs against `parse-email` with `enrich: true` |
| 1 | Fallback concatenation | Paste email with no working URLs; inspect `applications.description` ≥400 chars |
| 2 | Score parity | Run `scripts/score-parity-check.mjs` against user-supplied email |
| 2 | Regression | Delete an email-imported role and re-add it manually; compare scores |
| 2 | No-op when enrichment off | Send `enrich: false` explicitly from a test caller; behavior matches pre-change |

---

## Potential Risks & Gotchas

- **`enrich: true` default adds 1-15s latency to the modal** while URLs fetch in parallel. Mitigation: existing UI shows a parsing spinner in step 1; on the review step the user is already past the wait. No change needed unless measured latency exceeds 5s p50 — in that case, run enrichment after creation in the background like `autoResearchApplication` does today.
- **Bulk-create still uses `input.description` as the row value**, so the preview-scored description (which is the same `description` we send to bulk-create) reaches the DB unchanged. No second-round fetch is needed.
- **Same content arriving twice in two requests** (preview-score, then bulk-create) means research calls happen twice. Mitigation: short-term, accept the duplication; longer-term, cache `rawJobText` by URL on the server. Out of scope.
- **`whyItMatches` and `notableGaps` are LLM-generated summaries**, not job-description excerpts, so they may use different vocabulary than the actual posting. The fix doesn't claim to solve vocabulary mismatch — it just adds `rawText` (the unmodified email entry block) so the deterministic scorer has *some* correct signal. Vocabulary mismatch remains a future LLM-based re-scoring opportunity.
- **Free-tier cap**: bulk-create enforces 5 active applications per import. With auto-enrich, the user may now successfully create applications they previously would not have, but they still count against the cap the same way. No change.
- **`parseJobPost()` already runs inside `bulk-create`** (`bulk-create/route.ts:41-46`) on whatever `input.description` we provide. That means our `normalizeDescription` output flows through the same parsing pipeline as a manual paste — so the parse-time extraction (skill keywords, etc.) is identical between manual and email paths.

---

## Rollback Plan

All changes are gated by:
1. The modal defaulting `enrich: true` (one boolean flip).
2. New helpers `enrichWithRetries()` and `normalizeDescription()`.

To roll back:
- Revert the modal to `enrich: false`.
- Remove or gate `enrichWithRetries()` and `normalizeDescription()` calls behind a feature flag `EMAIL_IMPORT_ENRICH` (default `false` for prod, `true` for staging).
- DB has no migration; existing rows are untouched. New rows may have longer descriptions but the column is `TEXT` with no length cap, so no DDL change.

No destructive operations. The scoring regression check (Sprint 2) becomes a CI gate rather than a runtime path.

---

## Files Touched

| File | Change Type | Sprint |
|------|-------------|--------|
| `components/tracker/email-import-modal.tsx` | Modify (2 sites) | 1 |
| `app/api/applications/parse-email/route.ts` | Modify (retry helper) | 1 |
| `lib/email-match-parser.ts` | Add export | 1 |
| `app/api/applications/bulk-create/route.ts` | Modify (forward new field) | 2 |
| `app/api/applications/preview-score/route.ts` | Modify (accept new field) | 2 |
| `lib/tracker-studio.ts` | Modify (contextSnapshot extension) | 2 |
| `scripts/score-parity-check.mjs` | New | 2 |
| `docs/plans/email-import-scoring-fidelity-plan.md` | New | (this file) |
