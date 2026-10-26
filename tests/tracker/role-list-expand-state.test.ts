import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInitialExpandedSteps,
  toggleExpandedStep,
} from "@/components/tracker/role-list-expand-state";

test("opens only step 1 by default when the research group exists", () => {
  assert.deepEqual(buildInitialExpandedSteps([1, 2, 3, 4, 5, 6]), [1]);
});

test("starts fully collapsed when step 1 is absent", () => {
  assert.deepEqual(buildInitialExpandedSteps([2, 3, 4]), []);
});

test("toggles a section open and closed without affecting others", () => {
  const opened = toggleExpandedStep([1], 3);
  assert.deepEqual(opened, [1, 3]);

  const closed = toggleExpandedStep(opened, 1);
  assert.deepEqual(closed, [3]);
});
