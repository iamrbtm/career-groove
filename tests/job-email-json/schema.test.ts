import test from "node:test";
import assert from "node:assert/strict";
import { inputSchema } from "@/lib/job-email-json/bulk-import-schema";
import { extractJobJson } from "@/lib/job-email-json/extractor";
import { parseJobEmailPayload } from "@/lib/job-email-json/schema";
import {
  invalidJobsFoundBody,
  invalidWorkArrangementBody,
  malformedJsonBody,
  missingWorkArrangementBody,
  proseTrapBody,
  unsupportedVersionBody,
} from "./fixtures";

test("ignores misleading prose outside the JSON block", () => {
  const payload = parseJobEmailPayload(extractJobJson(proseTrapBody));
  assert.equal(payload.jobs[0].location, "United States");
  assert.equal(payload.jobs[0].salary.min, 53550);
});

test("rejects jobs_found mismatch", () => {
  assert.throws(() => parseJobEmailPayload(extractJobJson(invalidJobsFoundBody)));
});

test("rejects malformed JSON", () => {
  assert.throws(() => parseJobEmailPayload(extractJobJson(malformedJsonBody)));
});

test("rejects unsupported schema versions", () => {
  assert.throws(() => parseJobEmailPayload(extractJobJson(unsupportedVersionBody)));
});

test("normalizes invalid work arrangements to remote", () => {
  const payload = parseJobEmailPayload(extractJobJson(invalidWorkArrangementBody));
  assert.equal(payload.jobs[0].work_mode, "remote");
});

test("normalizes a missing work arrangement to remote", () => {
  const payload = parseJobEmailPayload(extractJobJson(missingWorkArrangementBody));
  assert.equal(payload.jobs[0].work_mode, "remote");
});

test("accepts only complete JSON-derived bulk import entries", () => {
  const job = parseJobEmailPayload(extractJobJson(proseTrapBody)).jobs[0];
  const result = inputSchema.safeParse({
    searchRunDate: "2026-08-09",
    entries: [{
      jobId: job.job_id,
      dedupeKey: job.dedupe_key,
      title: job.title,
      company: job.company,
      location: job.location,
      workMode: job.work_mode,
      salaryMin: job.salary.min,
      salaryMax: job.salary.max,
      salaryCurrency: job.salary.currency,
      salaryPeriod: job.salary.period,
      salaryRaw: job.salary.raw,
      sourceUrl: job.apply_url,
      canonicalUrl: job.canonical_url,
      sourceJobId: job.source_job_id,
      postingDate: job.posting_date,
      postingDateText: job.posting_date_text,
      discoveredDate: job.discovered_date,
      whyMatch: job.why_match,
      notableGaps: job.notable_gaps,
      description: job.why_match,
      notes: job.notable_gaps,
    }],
  });

  assert.equal(result.success, true);
  assert.equal(inputSchema.safeParse({ ...result.data, entries: [{ ...result.data?.entries[0], dedupeKey: "missing" }] }).success, false);
});
