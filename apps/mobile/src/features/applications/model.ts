import type { ApplicationStatus } from "@career-groove/shared";

export interface ApplicationSummary {
  company: string;
  followUpDueAt?: string | null;
  id: string;
  priorityLabel?: string | null;
  status: ApplicationStatus;
  title: string;
}

const pipeline = [
  { key: "saved", label: "Saved" },
  { key: "preparing", label: "Preparing" },
  { key: "applied", label: "Applied" },
  { key: "interviewing", label: "Interviewing" },
  { key: "offer", label: "Offer" },
  { key: "closed", label: "Closed" },
] as const;

function groupFor(status: ApplicationStatus) {
  if (status === "researching" || status === "ready_to_apply") return "preparing";
  if (status === "follow_up") return "applied";
  if (status === "rejected" || status === "withdrawn") return "closed";
  if (status === "archived") return null;
  return status;
}

export function groupApplications(items: ApplicationSummary[]) {
  return pipeline.map((group) => ({
    ...group,
    items: items.filter((item) => groupFor(item.status) === group.key),
  }));
}
