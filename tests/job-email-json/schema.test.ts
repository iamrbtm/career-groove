import test from "node:test";
import assert from "node:assert/strict";
import {
  exceedsFreeTierImportLimit,
  inputSchema,
  parseBulkEmailImportRequest,
} from "@/lib/job-email-json/bulk-import-schema";
import { extractJobJson } from "@/lib/job-email-json/extractor";
import { parseJobEmailPayload } from "@/lib/job-email-json/schema";
import {
  duplicateJobIdBody,
  invalidDateBody,
  invalidJobsFoundBody,
  invalidSalaryBody,
  invalidUrlBody,
  invalidWorkArrangementBody,
  malformedJsonBody,
  missingWorkArrangementBody,
  nullSalaryBody,
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

test("accepts a null salary block", () => {
  const payload = parseJobEmailPayload(extractJobJson(nullSalaryBody));
  assert.equal(payload.jobs[0].salary.min, null);
  assert.equal(payload.jobs[0].salary.period, "unknown");
});

test("rejects invalid salary typing", () => {
  assert.throws(() => parseJobEmailPayload(extractJobJson(invalidSalaryBody)));
});

test("rejects invalid top-level timestamps", () => {
  assert.throws(() => parseJobEmailPayload(extractJobJson(invalidDateBody)));
});

test("rejects invalid job URLs", () => {
  assert.throws(() => parseJobEmailPayload(extractJobJson(invalidUrlBody)));
});

test("rejects duplicate job ids in one payload", () => {
  assert.throws(() => parseJobEmailPayload(extractJobJson(duplicateJobIdBody)));
});

test("normalizes invalid work arrangements to remote", () => {
  const payload = parseJobEmailPayload(extractJobJson(invalidWorkArrangementBody));
  assert.equal(payload.jobs[0].work_mode, "remote");
});

test("normalizes a missing work arrangement to remote", () => {
  const payload = parseJobEmailPayload(extractJobJson(missingWorkArrangementBody));
  assert.equal(payload.jobs[0].work_mode, "remote");
});

test("bulk import derives selected jobs from the validated email JSON", () => {
  const job = parseJobEmailPayload(extractJobJson(proseTrapBody)).jobs[0];
  const request = inputSchema.parse({
    emailText: proseTrapBody,
    selectedJobIds: [job.job_id],
  });

  const result = parseBulkEmailImportRequest(request);
  assert.equal(result.searchRunDate, "2026-08-09");
  assert.equal(result.jobs[0].location, "United States");
  assert.equal(result.jobs[0].salary.min, 53550);
  assert.equal(inputSchema.safeParse({ selectedJobIds: [job.job_id], entries: [{ title: "forged" }] }).success, false);
  assert.throws(() => parseBulkEmailImportRequest(inputSchema.parse({
    emailText: proseTrapBody,
    selectedJobIds: ["forged-job-id"],
  })));
  assert.throws(() => parseBulkEmailImportRequest(inputSchema.parse({
    emailText: duplicateJobIdBody,
    selectedJobIds: [job.job_id],
  })));
});

test("free-tier import guard counts selected active roles", () => {
  assert.equal(exceedsFreeTierImportLimit(4, 1), false);
  assert.equal(exceedsFreeTierImportLimit(4, 2), true);
  assert.equal(exceedsFreeTierImportLimit(5, 1), true);
});
