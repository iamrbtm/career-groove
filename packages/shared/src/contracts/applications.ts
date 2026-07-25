import { z } from "zod";

import { jsonObjectSchema } from "./common.js";

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

export const applicationStatusSchema = z.enum(applicationStatuses);
export const commandSessionActionSchema = z.enum(commandSessionActions);
export const careerDjLabelSchema = z.enum(careerDjLabels);

const optionalText = (max = 5_000) =>
  z.string().trim().max(max).optional().nullable();
const optionalUrl = z
  .union([z.string().trim().url().max(2_000), z.literal(""), z.null()])
  .optional();
const optionalDateTime = z
  .union([z.string().datetime({ offset: true }), z.literal(""), z.null()])
  .optional();

const applicationBaseSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    company: z.string().trim().min(1).max(200),
    location: optionalText(200),
    workMode: z
      .enum(["remote", "hybrid", "onsite", "flexible", "unknown"])
      .optional()
      .nullable(),
    salaryMin: z.number().int().min(0).optional().nullable(),
    salaryMax: z.number().int().min(0).optional().nullable(),
    salaryCurrency: z.string().trim().length(3).default("USD"),
    sourceUrl: optionalUrl,
    source: optionalText(160),
    description: z.string().trim().min(1).max(50_000),
    notes: optionalText(20_000),
    metadata: jsonObjectSchema.default({}),
  })
  .strict();

const salaryRangeIsValid = (value: {
  salaryMin?: number | null;
  salaryMax?: number | null;
}) =>
  value.salaryMin == null ||
  value.salaryMax == null ||
  value.salaryMin <= value.salaryMax;

export const applicationCreateSchema = applicationBaseSchema.refine(
  salaryRangeIsValid,
  {
    message: "Minimum salary must not exceed maximum salary.",
    path: ["salaryMin"],
  },
);

export const applicationUpdateSchema = applicationBaseSchema
  .partial()
  .extend({
    status: applicationStatusSchema.optional(),
    priorityLabel: careerDjLabelSchema.optional().nullable(),
    nextActionType: commandSessionActionSchema.optional().nullable(),
    nextActionReason: optionalText(1_000),
    followUpDueAt: optionalDateTime,
    appliedAt: optionalDateTime,
  })
  .strict()
  .refine(salaryRangeIsValid, {
    message: "Minimum salary must not exceed maximum salary.",
    path: ["salaryMin"],
  });

export const applicationEventCreateSchema = z
  .object({
    eventType: z.enum([
      "note_added",
      "document_linked",
      "contact_linked",
      "follow_up",
      "interview",
      "outcome",
      "updated",
    ]),
    title: z.string().trim().min(1).max(200),
    body: optionalText(10_000),
    occurredAt: optionalDateTime,
    metadata: jsonObjectSchema.default({}),
  })
  .strict();

export const applicationPreferencesSchema = z
  .object({
    desiredTitles: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
    workModes: z
      .array(z.enum(["remote", "hybrid", "onsite", "flexible"]))
      .max(4)
      .default([]),
    salaryTarget: z.number().int().min(0).optional().nullable(),
    locationPreference: optionalText(200),
    industries: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
    values: z.array(z.string().trim().min(1).max(160)).max(30).default([]),
    redFlags: z.array(z.string().trim().min(1).max(160)).max(30).default([]),
    weeklyPace: z.number().int().min(0).max(50).optional().nullable(),
    defaultFollowUpDays: z.number().int().min(1).max(60).default(7),
  })
  .strict();

export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;
export type CommandSessionAction = z.infer<typeof commandSessionActionSchema>;
