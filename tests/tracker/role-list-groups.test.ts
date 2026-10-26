import test from "node:test";
import assert from "node:assert/strict";
import { buildRoleGroups } from "@/components/tracker/role-list-groups";

test("groups applications by tracker step and sorts each group by fit descending", () => {
  const groups = buildRoleGroups([
    {
      id: "saved-low",
      title: "Saved Low",
      company: "Alpha",
      status: "saved",
      latestScore: { fit: 41 },
    },
    {
      id: "applied-high",
      title: "Applied High",
      company: "Bravo",
      status: "applied",
      latestScore: { fit: 88 },
    },
    {
      id: "saved-high",
      title: "Saved High",
      company: "Charlie",
      status: "researching",
      latestScore: { fit: 92 },
    },
    {
      id: "saved-unscored",
      title: "Saved Unscored",
      company: "Delta",
      status: "saved",
      latestScore: null,
    },
    {
      id: "interview-mid",
      title: "Interview Mid",
      company: "Echo",
      status: "interviewing",
      latestScore: { fit: 75 },
    },
  ]);

  assert.deepEqual(
    groups.map((group) => ({
      step: group.step,
      title: group.title,
      ids: group.applications.map((application) => application.id),
    })),
    [
      { step: 1, title: "Research", ids: ["saved-high", "saved-low", "saved-unscored"] },
      { step: 3, title: "Follow-up", ids: ["applied-high"] },
      { step: 4, title: "Interview", ids: ["interview-mid"] },
    ],
  );
});

test("prefers explicit currentStep when present", () => {
  const groups = buildRoleGroups([
    {
      id: "override",
      title: "Override",
      company: "Foxtrot",
      status: "saved",
      currentStep: 5,
      latestScore: { fit: 60 },
    },
  ]);

  assert.equal(groups[0].step, 5);
  assert.equal(groups[0].title, "Decision");
});
