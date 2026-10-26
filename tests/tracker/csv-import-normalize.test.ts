import test from "node:test";
import assert from "node:assert/strict";
import { normalizeStatus, normalizeWorkMode } from "@/lib/csv-import-normalize";

test("normalizeWorkMode maps case-insensitive values to allowed column values", () => {
  assert.equal(normalizeWorkMode("Remote"), "remote");
  assert.equal(normalizeWorkMode("  HYBRID "), "hybrid");
  assert.equal(normalizeWorkMode("onsite"), "onsite");
  assert.equal(normalizeWorkMode("flexible"), "flexible");
  assert.equal(normalizeWorkMode("UNKNOWN"), "unknown");
});

test("normalizeWorkMode returns null for values outside the CHECK constraint", () => {
  assert.equal(normalizeWorkMode("work from home"), null);
  assert.equal(normalizeWorkMode(""), null);
});

test("normalizeStatus keeps valid statuses and defaults unknown ones", () => {
  assert.equal(normalizeStatus("Ready to Apply"), "ready_to_apply");
  assert.equal(normalizeStatus("bogus"), "saved");
});
