# Plan: Daily Job Matches Email Import

**Generated**: 2026-08-07
**Estimated Complexity**: Medium
**Sprints**: 4

## Overview

Add the ability to paste a "Daily Job Matches" email into CareerGroove, parse out the individual job listings, enrich them by fetching their Apply URLs, present them in a review step with Career DJ fit scores, and create applications for each confirmed role.

The email format is: a greeting header, numbered job entries (each with title, company, location, work arrangement, posting date, salary, "Why it matches", "Notable gaps", and an Apply URL), followed by a recommended-order footer.

### Approach
1. Build a dedicated email parser that splits the email into individual job entries and extracts structured fields from each.
2. Reuse the existing `parseJobPost()` and `researchUrl()` utilities for per-job parsing and URL enrichment.
3. Create a preview-scoring path that computes fit scores without persisting applications, so the review UI can display them.
4. Build a bulk-create endpoint that inserts all confirmed applications in one transaction, each scored.
5. Add a paste-email modal to the Tracker Studio.

---

## Prerequisites
- No new dependencies — uses existing `parseJobPost`, `researchUrl`, `callAI`, `refreshApplicationScore`.
- User must have an active AI provider connection (for URL enrichment scoring context).
- Free-tier cap (5 active roles) applies to bulk creation.

---

## Sprint 1: Email Parser Library

**Goal**: Given raw email text, split into header, job entries, and footer. Extract structured fields from each entry.

**Demo/Validation**:
- Run `node -e` test with the sample email and verify 6 jobs are parsed with correct title/company/location/salary.
- Verify header and footer are separated out and not treated as job data.

### Task 1.1: Create `lib/email-match-parser.ts`
- **Location**: `lib/email-match-parser.ts`
- **Description**: New module mirroring the structure of `lib/job-post-parser.ts`. Exports `parsedEmailSchema` / `ParsedEmail` and `parseJobMatchEmail(input): ParsedEmailMatch`.
- **Dependencies**: None
- **Acceptance Criteria**:
  - Exports `ParsedEmailMatch` type: `{ header: string, footer: string, jobs: ParsedJobEntry[], parseWarnings: string[] }`
  - Exports `ParsedJobEntry` type: `{ title, company, location, workArrangement, postingDate, salaryMin, salaryMax, salaryCurrency, whyItMatches, notableGaps, applyUrl, rawText, confidence }`
  - `parseJobMatchEmail({ text })` splits email into entries using the numbered-list pattern `^\d+)\s+`
  - Extracts title and company from the first line using the `—` (em dash) delimiter: `Title — Company`
  - Extracts "Location:", "Work arrangement:", "Posting date:", "Salary:" from labeled lines
  - Extracts "Why it matches:" and "Notable gaps:" paragraph blocks
  - Extracts Apply URL from `Apply:\s*(https?:\S+)`
  - Detects salary ranges in `$XX,XXX-$XX,XXX` format (reuse logic from `extractSalary`)
  - Assigns `confidence: "high"` when title + company + applyUrl present, `"medium"` when title + company but no URL, `"low"` when only one of title/company found
  - Skips entries where neither title nor company can be determined, adds a warning to `parseWarnings`
  - Identifies header (text before first numbered entry) and footer (text after last numbered entry, including "Recommended order:")
- **Validation**:
  - Unit test: feed the sample email, assert `jobs.length === 6`, verify first job is `{ title: "Application Support Analyst I", company: "Omnigo Software", salaryMin: null, salaryMax: null }`, verify job 2 has `salaryMin: 55000, salaryMax: 71000`
  - Verify `applyUrl` extraction works for `https://to.indeed.com/...` format
  - Verify header contains "Jeremy" and footer contains "Recommended order"

### Task 1.2: Add Zod schema file
- **Location**: `lib/email-match-schema.ts`
- **Description**: Zod schemas for email parse input/output, following the pattern of `lib/application-schema.ts`.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - `emailMatchParseInputSchema`: `{ text: z.string().trim().min(50).max(80000) }`
  - `emailMatchEntrySchema`: validates a single parsed job entry
  - `emailMatchParseResultSchema`: validates the full result
- **Validation**:
  - Schema rejects empty text, accepts email up to 80k chars

---

## Sprint 2: Parse Email API + URL Enrichment

**Goal**: API endpoint that accepts raw email text, returns parsed jobs with enriched data from Apply URLs.

**Demo/Validation**:
- `POST /api/applications/parse-email` with sample email returns 6 parsed jobs with enriched descriptions.
- URLs that fail to fetch don't block — the parsed email data is still returned with a warning.

### Task 2.1: Create `POST /api/applications/parse-email`
- **Location**: `app/api/applications/parse-email/route.ts`
- **Description**: New route, sibling to existing `parse` and `parse-url`. Accepts raw email text, runs `parseJobMatchEmail`, optionally enriches each job by fetching its Apply URL.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Validates input with `emailMatchParseInputSchema`
  - Calls `parseJobMatchEmail()` to split and parse
  - If `enrich: true` passed in body, fires `researchUrl(applyUrl)` for each job in parallel (with `Promise.allSettled`)
  - On enrichment success: merges `jobPosting` fields into the entry, sets `description` from `rawJobText`, updates `confidence` to "high" if it was lower
  - On enrichment failure: keeps original parsed data, adds a warning
  - Returns `{ header, footer, jobs: [...], enrichmentStatus: "complete" | "partial" | "none", warnings: [...] }`
  - Enrichment is fire-and-forget with a 15s timeout per URL (don't block response on slow URLs)
  - Respects `isSafeUrl()` SSRF guard from `lib/research.ts`
- **Validation**:
  - Test with `enrich: false` — returns 6 jobs from email text alone
  - Test with `enrich: true` — returns enriched data (may be partial if URLs are unreachable in test env)
  - Test with malformed input — returns 400

### Task 2.2: Create preview-score helper
- **Location**: `lib/tracker-studio.ts` (add new export)
- **Description**: `previewApplicationScore(userId, jobEntry)` — computes Career DJ score without persisting an application. Uses existing `computeScore()` but reads tracker context without needing an application ID.
- **Dependencies**: None (uses existing `loadTrackerContext`, `computeScore`)
- **Acceptance Criteria**:
  - Temporarily constructs an `ApplicationRow`-like object from the parsed entry
  - Calls `computeScore()` with the fake row + real tracker context
  - Returns `{ fit, readiness, desire, leverage, risk, timing, label, reasons, gaps, nextAction }` — same shape as `refreshApplicationScore`'s result but without DB writes
  - Does NOT write to `application_scores` or `applications` tables
- **Validation**:
  - Call with a parsed job entry, verify it returns a score object with numeric fit/readiness/etc.

### Task 2.3: Create `POST /api/applications/preview-score`
- **Location**: `app/api/applications/preview-score/route.ts`
- **Description**: Accepts a parsed job entry (or array of them) and returns Career DJ scores for display in the review UI.
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Accepts single entry `{ entry: ParsedJobEntry }` or batch `{ entries: ParsedJobEntry[] }`
  - Calls `previewApplicationScore()` for each
  - Returns `{ scores: [{ entryIndex, fit, readiness, desire, leverage, risk, timing, label, reasons, gaps, nextAction }] }`
  - Used by the review UI to display scores before creating applications
- **Validation**:
  - POST with one entry → returns one score
  - POST with 3 entries → returns 3 scores in order

---

## Sprint 3: Review UI with Fit Scores

**Goal**: Paste-email flow in the Tracker Studio that shows parsed jobs with fit scores, allows edit/remove, and confirms to create.

**Demo/Validation**:
- Open Tracker → click "Paste job email" → paste sample → see 6 cards with fit scores → remove 1 → edit title on another → confirm → 5 applications appear in tracker.

### Task 3.1: Create `EmailImportModal` component
- **Location**: `components/tracker/email-import-modal.tsx`
- **Description**: New modal (sibling to `capture-modal.tsx`) for the paste-email flow. Multi-step: paste → parsing → review with scores → success.
- **Dependencies**: Task 2.1, Task 2.3
- **Acceptance Criteria**:
  - **Step 1 — Paste**: Large textarea with placeholder "Paste your Daily Job Matches email here..." + "Parse email" button. Shows parsing spinner.
  - **Step 2 — Review**: Scrollable list of job cards. Each card shows:
    - Title, company, location, work arrangement, salary (editable inputs)
    - Career DJ fit score ring (fit number + color-coded label)
    - Readiness, desire, leverage, risk, timing mini-bars
    - "Why it matches" and "Notable gaps" as read-only text
    - Apply URL (clickable link)
    - Remove button (×) per card
  - **Step 2 — Header/Footer**: Shows email header text (collapsible) so user can verify what was parsed
  - **Step 2 — Warnings**: Shows `parseWarnings` (skipped entries) and `enrichmentStatus`
  - **Step 3 — Confirm**: "Create N applications" button. Shows spinner while creating.
  - **Step 4 — Success**: "N applications created!" with link to tracker. Lists any that failed.
  - Edits in review step update the entry in local state (controlled inputs)
  - Removed entries are excluded from creation
  - Modal closes on backdrop click only during paste step (prevent accidental loss during review)
- **Validation**:
  - Paste sample email → step 2 shows 6 cards
  - Remove 1 card → button says "Create 5 applications"
  - Edit a title → change persists in the card
  - Confirm → applications created in DB

### Task 3.2: Add "Paste job email" entry point to Tracker
- **Location**: `components/tracker/tracker-page.tsx`
- **Description**: Add a "Paste job email" button alongside the existing "Capture a role" button. Opens `EmailImportModal`.
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - New button with Mail icon from lucide-react
  - Positioned next to "Capture a role" in the canvas header
  - Opens `EmailImportModal` on click
- **Validation**:
  - Button visible in tracker UI, click opens modal

### Task 3.3: Create `POST /api/applications/bulk-create`
- **Location**: `app/api/applications/bulk-create/route.ts`
- **Description**: Creates multiple applications in a single request, each scored, in one transaction.
- **Dependencies**: Existing `POST /api/applications` logic
- **Acceptance Criteria**:
  - Accepts `{ entries: applicationCreateSchema[] }` (reuses existing schema)
  - Checks free-tier cap: total active + new entries cannot exceed 5
  - `BEGIN` transaction
  - For each entry: INSERT application → INSERT `created` event → `refreshApplicationScore`
  - `COMMIT` on success, `ROLLBACK` on any failure
  - Returns `{ created: [{ id, title, company, latestScore }], failed: [{ index, reason }] }`
  - Fires `autoResearchApplication` fire-and-forget for each created application
  - If any entry fails, rolls back ALL (atomic — all-or-nothing)
- **Validation**:
  - POST with 3 valid entries → 3 applications in DB with scores
  - POST exceeding free tier → 403 with message
  - POST with 1 invalid entry (missing title) → 400, nothing created

---

## Sprint 4: Polish & Edge Cases

**Goal**: Handle edge cases gracefully, add AI fallback for low-confidence entries, improve UX.

**Demo/Validation**:
- Malformed email → user sees which entries were skipped and why.
- URL fetch failure → still creates application from email data, flags as un-enriched.
- AI fallback works for entries where title/company can't be parsed.

### Task 4.1: AI fallback for low-confidence entries
- **Location**: `lib/email-match-parser.ts` (extend Task 1.1)
- **Description**: When an entry parses with `confidence: "low"`, optionally escalate to AI via `callAI()` to extract title/company from the raw text.
- **Dependencies**: Existing `callAI()`
- **Acceptance Criteria**:
  - `parseJobMatchEmail({ text, useAI: true })` — when `useAI` is true and a job entry has `confidence: "low"`, calls `callAI()` with a targeted prompt asking to extract title, company, location from the raw text block
  - AI result is parsed as JSON and merged into the entry
  - Entry confidence is upgraded to "medium" if AI returns both title and company
  - If AI fails or returns unparseable data, original low-confidence data is kept with a warning
  - AI call has a 10s timeout
- **Validation**:
  - Feed an intentionally broken entry (no clear title/company) with `useAI: true` → AI extracts correct fields
  - Feed with `useAI: false` → entry stays low-confidence

### Task 4.2: Add warnings display to review UI
- **Location**: `components/tracker/email-import-modal.tsx`
- **Description**: Show parse warnings and enrichment failures prominently in the review step.
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Banner at top of review step showing: "N jobs parsed, M skipped" with details
  - Each card with `confidence: "low"` has a yellow "Low confidence — please review" badge
  - Each card with failed enrichment has an orange "URL not fetched — using email data only" badge
  - Skipped entries listed in a collapsible "Skipped" section with raw text snippet
- **Validation**:
  - Deliberately malformed email → warnings visible in review

### Task 4.3: Extensibility hooks for future auto-sync
- **Location**: `lib/email-match-parser.ts` (export shared helpers)
- **Description**: Structure the parser so it can be reused by a future email inbox sync worker. Export helpers that a sync worker would need.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - `splitEmailEntries(text)` — exported separately so a sync worker can split any email
  - `parseJobEntry(rawEntryText)` — exported separately for parsing a single entry
  - Parser has no dependency on Next.js request/response — pure function, usable in a Node worker
  - Document in code comments where a future IMAP/sync integration would plug in
- **Validation**:
  - Import `splitEmailEntries` and `parseJobEntry` in a standalone Node script — works without Next.js runtime

---

## Testing Strategy

| Sprint | What to Test | How |
|--------|-------------|-----|
| 1 | Email splitting & field extraction | Node script with sample email + edge cases (missing salary, missing URL, malformed entry) |
| 2 | API enrichment | curl POST to parse-email with enrich true/false; verify response shape |
| 2 | Preview scores | curl POST to preview-score; verify scores are numeric 0-100 |
| 3 | End-to-end flow | Paste email → review → confirm → verify applications appear in tracker with correct data |
| 3 | Bulk create atomicity | Send 3 entries where 1 is invalid → verify 0 created (rollback) |
| 4 | AI fallback | Craft ambiguous entry → verify AI extracts fields |
| 4 | Free-tier cap | Free user with 3 active roles → try bulk-create 3 → 403 (would exceed 5) |

---

## Potential Risks & Gotchas

- **URL enrichment is slow**: Fetching 6 URLs sequentially could take 30s+. Mitigation: parallel `Promise.allSettled` with individual 12s timeouts, fire-and-forget after returning parsed data. UI shows "enriching..." state.
- **Indeed short links (`to.indeed.com`)**: These are redirects. `researchUrl()` follows redirects but the final page may be a Cloudflare challenge. Mitigation: if enrichment fails, fall back to email-parsed data gracefully.
- **Email format drift**: If the email sender changes formatting, the parser may break. Mitigation: `parseWarnings` surface issues; AI fallback handles edge cases; confidence scoring flags low-quality parses for manual review.
- **Free-tier cap mid-bulk**: User has 4 active roles, tries to create 3 → cap exceeded. Mitigation: validate total before starting transaction, return clear 403.
- **Duplicate detection**: Pasting the same email twice creates duplicate applications. Mitigation: future enhancement (not in this plan) — for now, user can see duplicates in review step and remove them.
- **Long emails**: Some emails could have 10+ jobs. Mitigation: parser handles any number of entries; UI scrolls; bulk create handles arrays.
- **Missing `description` field**: Applications require `description` (NOT NULL). Mitigation: if enrichment fails and email "Why it matches" is the only text, use it as description. If nothing available, skip that entry with a warning.

---

## Rollback Plan

- All changes are additive (new files, new endpoints, new UI). No existing functionality is modified.
- To remove: delete `lib/email-match-parser.ts`, `lib/email-match-schema.ts`, `app/api/applications/parse-email/`, `app/api/applications/preview-score/`, `app/api/applications/bulk-create/`, `components/tracker/email-import-modal.tsx`. Revert the button addition in `tracker-page.tsx`.
- No database migrations needed for this feature (uses existing `applications` table).
