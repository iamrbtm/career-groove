import test from "node:test";
import assert from "node:assert/strict";
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
