import { z } from "zod";
import { JobEmailImportError } from "@/lib/job-email-json/errors";

const workModeSchema = z.string().optional().transform((value) => (
  value === "hybrid" || value === "onsite" ? value : "remote"
));

const jobSchema = z.object({
  job_id: z.string().min(1),
  dedupe_key: z.string().regex(/^[a-f0-9]{64}$/),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().min(1),
  work_arrangement: workModeSchema,
  posting_date: z.string().nullable(),
  posting_date_text: z.string().nullable(),
  discovered_date: z.string().nullable(),
  salary: z.object({
    min: z.number().nullable(),
    max: z.number().nullable(),
    currency: z.literal("USD"),
    period: z.enum(["hour", "year", "unknown"]),
    raw: z.string().nullable(),
  }),
  why_match: z.string(),
  notable_gaps: z.string(),
  apply_url: z.string(),
  canonical_url: z.string().nullable(),
  source_job_id: z.string().nullable(),
}).transform(({ work_arrangement, ...job }) => ({
  ...job,
  work_arrangement,
  work_mode: work_arrangement,
}));

const payloadSchema = z.object({
  schema_version: z.literal("1.0"),
  generated_at: z.string().nullable(),
  search_run_date: z.string().nullable(),
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
});

export const parseEmailImportInput = z.object({
  text: z.string().trim().min(1).max(80000),
});

export type ParsedJobEmailPayload = z.infer<typeof payloadSchema>;

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

  const result = payloadSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new JobEmailImportError("JOB_JSON_VALIDATION_FAILED", "The job JSON payload failed validation.");
  }

  return result.data;
}
