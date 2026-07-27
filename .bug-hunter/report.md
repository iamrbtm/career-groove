# Bug Hunter Report

- Findings reviewed: 6
- Confirmed: 6
- Dismissed: 0
- Manual review: 0

## Confirmed Bugs
- BUG-1 | Critical | app/api/applications/parse-url/route.ts | Server-Side Request Forgery (SSRF) — user-provided URL is fetched without validation, allowing access to internal network services.
  Confidence: 95 (high) | code-review
  Analysis: SSRF via unvalidated fetch(url) — confirmed by re-reading parse-url/route.ts line 13. No allowlist, no scheme restriction, no private IP block. Critical security issue.
- BUG-2 | High | app/api/applications/import/route.ts | CSV parser splits on newlines before parsing quoted fields, breaking multiline quoted values per RFC 4180 and corrupting data.
  Confidence: 93 (high) | code-review
  Analysis: CSV split on raw newlines destroys multiline quoted fields per RFC 4180. Confirmed by re-reading import/route.ts line 42.
- BUG-3 | High | app/api/applications/import/route.ts | Unvalidated salary fields produce NaN which PostgreSQL rejects, aborting entire multi-row import transaction and discarding all valid rows.
  Confidence: 98 (high) | code-review
  Analysis: NaN salary values crash entire import transaction. Number('competitive') is NaN which PostgreSQL numeric rejects. Confirmed at import/route.ts lines 79-80.
- BUG-4 | Medium | app/api/applications/import/route.ts | Date fields followUpDueAt and appliedAt passed to PostgreSQL without date validation, causing transaction rollback on invalid strings.
  Confidence: 93 (high) | code-review
  Analysis: Unvalidated date strings passed to PostgreSQL with only truthy/falsy coercion. Same root cause as BUG-3. Confirmed at import/route.ts lines 87-88.
- BUG-5 | Medium | app/api/applications/[id]/outcomes/route.ts | roleFit and similarStrategy fields are injected into the offer JSONB column instead of being stored as their own columns, causing persistent data loss.
  Confidence: 85 (high) | code-review
  Analysis: roleFit/similarStrategy fields silently routed into offer JSONB instead of their own columns. Confirmed at outcomes/route.ts lines 87-91.
- BUG-6 | Low | app/api/applications/import/route.ts | No row-count limit on CSV import allows a single request to exhaust server memory, connections, and DB resources via arbitrarily large payloads.
  Confidence: 80 (medium) | code-review
  Analysis: No row-count limit on CSV import allows resource exhaustion. Entire CSV loaded in memory with no caps.

## Manual Review
- None

## Dismissed Findings
- None
