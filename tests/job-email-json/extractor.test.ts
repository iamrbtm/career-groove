import test from "node:test";
import assert from "node:assert/strict";
import { extractJobJson } from "@/lib/job-email-json/extractor";
import {
  invalidBase64Body,
  missingBase64EndMarkerBody,
  missingEndMarkerBody,
  missingMarkerBody,
  proseTrapBase64Body,
  proseTrapBody,
  validBase64EmailBody,
  validEmailBody,
} from "./fixtures";

test("extracts JSON between markers", () => {
  assert.match(extractJobJson(validEmailBody), /^\{/);
});

test("ignores misleading prose outside the JSON block", () => {
  assert.match(extractJobJson(proseTrapBody), /^\{/);
  assert.doesNotMatch(extractJobJson(proseTrapBody), /Mars|\$1/);
});

test("extracts JSON from a base64 payload block", () => {
  assert.match(extractJobJson(validBase64EmailBody), /^\{/);
});

test("ignores misleading prose outside a base64 payload block", () => {
  assert.match(extractJobJson(proseTrapBase64Body), /^\{/);
  assert.doesNotMatch(extractJobJson(proseTrapBase64Body), /Mars|\$1/);
});

test("rejects an email with missing JSON markers", () => {
  assert.throws(() => extractJobJson(missingMarkerBody));
});

test("rejects an email with a missing JSON end marker", () => {
  assert.throws(() => extractJobJson(missingEndMarkerBody));
});

test("rejects an email with a missing base64 end marker", () => {
  assert.throws(() => extractJobJson(missingBase64EndMarkerBody));
});

test("rejects an email with an invalid base64 payload block", () => {
  assert.throws(() => extractJobJson(invalidBase64Body));
});
