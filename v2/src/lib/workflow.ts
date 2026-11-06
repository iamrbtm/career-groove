export const STAGES = ["lead", "preparing", "applied", "interviewing", "decision"] as const;
export type Stage = (typeof STAGES)[number];

export const OUTCOMES = ["offer", "rejected", "withdrawn", "accepted", "declined"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const ACTION_TYPES = [
  "research",
  "decide_fit",
  "tailor_documents",
  "apply",
  "follow_up",
  "prep_interview",
  "review_offer",
  "close",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const stageLabels: Record<Stage, string> = {
  lead: "Lead",
  preparing: "Preparing",
  applied: "Applied",
  interviewing: "Interviewing",
  decision: "Decision",
};

export const outcomeLabels: Record<Outcome, string> = {
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  accepted: "Accepted",
  declined: "Declined",
};

export const actionLabels: Record<ActionType, string> = {
  research: "Research",
  decide_fit: "Decide fit",
  tailor_documents: "Tailor documents",
  apply: "Apply",
  follow_up: "Follow up",
  prep_interview: "Prep interview",
  review_offer: "Review offer",
  close: "Close",
};

export function isStage(value: string | null | undefined): value is Stage {
  return !!value && (STAGES as readonly string[]).includes(value);
}

export function isOutcome(value: string | null | undefined): value is Outcome {
  return !!value && (OUTCOMES as readonly string[]).includes(value);
}

export function isActionType(value: string | null | undefined): value is ActionType {
  return !!value && (ACTION_TYPES as readonly string[]).includes(value);
}

export function defaultAction(stage: Stage, interviewAt?: Date | null): {
  type: ActionType;
  dueAt: Date;
} {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  switch (stage) {
    case "lead":
      return { type: "decide_fit", dueAt: new Date(now + 2 * day) };
    case "preparing":
      return { type: "tailor_documents", dueAt: new Date(now + 3 * day) };
    case "applied":
      return { type: "follow_up", dueAt: new Date(now + 7 * day) };
    case "interviewing":
      return {
        type: "prep_interview",
        dueAt: interviewAt ?? new Date(now + 2 * day),
      };
    case "decision":
      return { type: "review_offer", dueAt: new Date(now + 2 * day) };
  }
}

export function validateStageChange(stage: Stage, outcome: string | null): string | null {
  if (stage === "decision" && !isOutcome(outcome)) {
    return "Decision stage requires an outcome (offer, rejected, withdrawn, accepted, or declined).";
  }
  if (stage !== "decision" && outcome) {
    return "Only decision-stage applications can have an outcome.";
  }
  return null;
}

export function stageBadgeClass(stage: string): string {
  return `badge badge-${stage}`;
}
