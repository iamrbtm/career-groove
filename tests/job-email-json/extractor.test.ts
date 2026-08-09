import test from "node:test";
import assert from "node:assert/strict";
import { extractJobJson } from "@/lib/job-email-json/extractor";
import {
  missingEndMarkerBody,
  missingMarkerBody,
  proseTrapBody,
  validEmailBody,
} from "./fixtures";

test("extracts JSON between markers", () => {
  assert.match(extractJobJson(validEmailBody), /^\{/);
});

test("ignores misleading prose outside the JSON block", () => {
  assert.match(extractJobJson(proseTrapBody), /^\{/);
  assert.doesNotMatch(extractJobJson(proseTrapBody), /Mars|\$1/);
});

test("rejects an email with missing JSON markers", () => {
  assert.throws(() => extractJobJson(missingMarkerBody));
});

test("rejects an email with a missing JSON end marker", () => {
  assert.throws(() => extractJobJson(missingEndMarkerBody));
});
