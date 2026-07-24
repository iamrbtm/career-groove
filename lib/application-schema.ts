import { z } from "zod";

export const applicationStatuses = [
  "saved",
  "researching",
  "ready_to_apply",
  "applied",
  "follow_up",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
  "archived",
] as const;

export const commandSessionActions = [
  "capture_job",
  "research_company",
  "remix_resume",
  "draft_cover_letter",
  "answer_questions",
  "apply",
  "follow_up",
  "contact_referral",
  "prep_interview",
  "log_outcome",
  "review_rejection",
  "compare_offer",
  "archive_role",
] as const;

export const careerDjLabels = [
  "apply_first",
  "research_before_applying",
  "remix_resume_first",
  "network_first",
  "stretch_role",
  "low_signal_lead",
  "probably_skip",
  "follow_up_now",
  "prep_mode",
] as const;

export const statusLabels: Record<ApplicationStatus, string> = {
  saved: "Saved",
  researching: "Researching",
  ready_to_apply: "Ready to apply",
  applied: "Applied",
  follow_up: "Follow-up",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  archived: "Archived",
};

export const pipelineColumns: Record<ApplicationStatus, string> = {
  saved: "Saved",
  researching: "Preparing",
  ready_to_apply: "Preparing",
  applied: "Applied",
  follow_up: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Closed",
  withdrawn: "Closed",
  archived: "Archived",
};

export const allowedNextActions: Record<ApplicationStatus, CommandSessionAction[]> = {
  saved: ["research_company", "remix_resume", "contact_referral", "apply", "archive_role"],
  researching: ["research_company", "contact_referral", "remix_resume", "apply", "archive_role"],
  ready_to_apply: ["remix_resume", "draft_cover_letter", "answer_questions", "apply", "archive_role"],
  applied: ["follow_up", "contact_referral", "prep_interview", "log_outcome"],
  follow_up: ["follow_up", "contact_referral", "prep_interview", "log_outcome"],
  interviewing: ["prep_interview", "follow_up", "log_outcome", "compare_offer"],
  offer: ["compare_offer", "log_outcome"],
  rejected: ["review_rejection", "archive_role"],
  withdrawn: ["archive_role"],
  archived: ["capture_job"],
};

export const applicationStatusSchema = z.enum(applicationStatuses);
export const commandSessionActionSchema = z.enum(commandSessionActions);
export const careerDjLabelSchema = z.enum(careerDjLabels);
export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;
export type CommandSessionAction = z.infer<typeof commandSessionActionSchema>;

const optionalText = (max = 5000) => z.string().trim().max(max).optional().nullable();
const optionalUrl = z.union([z.string().trim().url().max(2000), z.literal(""), z.null()]).optional();
const optionalDateTime = z.union([z.string().datetime(), z.literal(""), z.null()]).optional();

const applicationBaseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  company: z.string().trim().min(1).max(200),
  location: optionalText(200),
  workMode: z.enum(["remote", "hybrid", "onsite", "flexible", "unknown"]).optional().nullable(),
  salaryMin: z.number().int().min(0).optional().nullable(),
  salaryMax: z.number().int().min(0).optional().nullable(),
  salaryCurrency: z.string().trim().length(3).default("USD"),
  sourceUrl: optionalUrl,
  source: optionalText(160),
  description: z.string().trim().min(1).max(50000),
  notes: optionalText(20000),
  metadata: z.record(z.unknown()).default({}),
});

export const applicationCreateSchema = applicationBaseSchema.refine((value) => !value.salaryMin || !value.salaryMax || value.salaryMin <= value.salaryMax, {
  message: "Minimum salary must be less than maximum salary.",
  path: ["salaryMin"],
});

export const applicationUpdateSchema = applicationBaseSchema.partial().extend({
  status: applicationStatusSchema.optional(),
  priorityLabel: careerDjLabelSchema.optional().nullable(),
  nextActionType: commandSessionActionSchema.optional().nullable(),
  nextActionReason: optionalText(1000),
  followUpDueAt: optionalDateTime,
  appliedAt: optionalDateTime,
}).refine((value) => !value.salaryMin || !value.salaryMax || value.salaryMin <= value.salaryMax, {
  message: "Minimum salary must be less than maximum salary.",
  path: ["salaryMin"],
});

export const applicationEventCreateSchema = z.object({
  eventType: z.enum(["note_added", "document_linked", "contact_linked", "follow_up", "interview", "outcome", "updated"]),
  title: z.string().trim().min(1).max(200),
  body: optionalText(10000),
  occurredAt: optionalDateTime,
  metadata: z.record(z.unknown()).default({}),
});

export const applicationPreferencesSchema = z.object({
  desiredTitles: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  workModes: z.array(z.enum(["remote", "hybrid", "onsite", "flexible"])).max(4).default([]),
  salaryTarget: z.number().int().min(0).optional().nullable(),
  locationPreference: optionalText(200),
  industries: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  values: z.array(z.string().trim().min(1).max(160)).max(30).default([]),
  redFlags: z.array(z.string().trim().min(1).max(160)).max(30).default([]),
  weeklyPace: z.number().int().min(0).max(50).optional().nullable(),
  defaultFollowUpDays: z.number().int().min(1).max(60).default(7),
});

export const applicationTransitionSchema = z.object({
  from: applicationStatusSchema,
  to: applicationStatusSchema,
}).refine(({ from, to }) => from === to || allowedNextActions[from].length > 0, "Invalid transition.");
