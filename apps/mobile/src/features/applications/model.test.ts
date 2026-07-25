import { describe, expect, it } from "vitest";

import {
  groupApplications,
  type ApplicationSummary,
} from "./model";

const application = (
  status: ApplicationSummary["status"],
): ApplicationSummary => ({
  company: "Acme",
  id: status,
  status,
  title: "Engineer",
});

describe("groupApplications", () => {
  it("maps workflow statuses into the visible pipeline", () => {
    const grouped = groupApplications([
      application("saved"),
      application("ready_to_apply"),
      application("applied"),
      application("interviewing"),
      application("offer"),
      application("rejected"),
      application("archived"),
    ]);

    expect(grouped.map((group) => [group.key, group.items.length])).toEqual([
      ["saved", 1],
      ["preparing", 1],
      ["applied", 1],
      ["interviewing", 1],
      ["offer", 1],
      ["closed", 1],
    ]);
  });
});
