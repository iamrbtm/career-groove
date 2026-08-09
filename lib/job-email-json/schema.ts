import { z } from "zod";
import { jobEmailImportEntrySchema } from "@/lib/application-schema";
import { JobEmailImportError } from "@/lib/job-email-json/errors";

const workModeSchema = z.string().optional().transform((value) => (
  value === "remote" || value === "hybrid" || value === "onsite" ? value : "remote"
));

const salarySchema = jobEmailImportEntrySchema.shape.salary;

const jobSchema = z.object({
  job_id: jobEmailImportEntrySchema.shape.jobId,
  dedupe_key: jobEmailImportEntrySchema.shape.dedupeKey,
  title: jobEmailImportEntrySchema.shape.title,
  company: jobEmailImportEntrySchema.shape.company,
  location: jobEmailImportEntrySchema.shape.location,
  work_arrangement: workModeSchema,
  posting_date: jobEmailImportEntrySchema.shape.postingDate,
  posting_date_text: jobEmailImportEntrySchema.shape.postingDateText,
  discovered_date: jobEmailImportEntrySchema.shape.discoveredDate,
  salary: salarySchema,
  why_match: jobEmailImportEntrySchema.shape.whyMatch,
  notable_gaps: jobEmailImportEntrySchema.shape.notableGaps,
  apply_url: jobEmailImportEntrySchema.shape.applyUrl,
  canonical_url: jobEmailImportEntrySchema.shape.canonicalUrl,
  source_job_id: jobEmailImportEntrySchema.shape.sourceJobId,
}).transform(({ work_arrangement, ...job }) => ({
  ...job,
  work_arrangement,
  work_mode: work_arrangement,
}));

export const jobEmailPayloadSchema = z.object({
  schema_version: z.literal("1.0"),
  generated_at: z.string().datetime({ offset: true }).nullable(),
  search_run_date: z.string().date().nullable(),
  jobs_found: z.number().int().nonnegative(),
  jobs: z.array(jobSchema),
}).superRefine((payload, context) => {
  if (payload.jobs_found !== payload.jobs.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["jobs_found"],
      message: "jobs_found must equal jobs.length.",
    });
  }

  const seenJobIds = new Set<string>();
  payload.jobs.forEach((job, index) => {
    if (seenJobIds.has(job.job_id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["jobs", index, "job_id"],
        message: "job_id values must be unique within a payload.",
      });
      return;
    }
    seenJobIds.add(job.job_id);
  });
});

export const parseEmailImportInput = z.object({
  text: z.string().trim().min(1).max(80000),
});

export type ParsedJobEmailPayload = z.infer<typeof jobEmailPayloadSchema>;

export function parseJobEmailPayload(jsonText: string): ParsedJobEmailPayload {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(jsonText);
  } catch {
    throw new JobEmailImportError("JOB_JSON_INVALID", "The job JSON block is invalid.");
  }

  if (
    typeof parsedJson === "object"
    && parsedJson !== null
    && "schema_version" in parsedJson
    && (parsedJson as { schema_version?: unknown }).schema_version !== "1.0"
  ) {
    throw new JobEmailImportError("JOB_JSON_SCHEMA_UNSUPPORTED", "The job JSON schema version is unsupported.");
  }

  const result = jobEmailPayloadSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new JobEmailImportError("JOB_JSON_VALIDATION_FAILED", "The job JSON payload failed validation.");
  }

  return result.data;
}
