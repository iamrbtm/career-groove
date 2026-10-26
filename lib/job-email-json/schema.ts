import { z } from "zod";
import { jobDescriptionSchema, rawDescriptionSourceSchema } from "@/lib/application-schema";
import { JobEmailImportError } from "@/lib/job-email-json/errors";

function normalizeJobDescriptionShape(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const input = value as Record<string, unknown>;
  return {
    ...input,
    requiredQualifications: input.requiredQualifications ?? input.required_qualifications,
    preferredQualifications: input.preferredQualifications ?? input.preferred_qualifications,
    employmentType: input.employmentType ?? input.employment_type,
    otherRequirements: input.otherRequirements ?? input.other_requirements,
    sourceUrl: input.sourceUrl ?? input.source_url,
    fetchedAt: input.fetchedAt ?? input.fetched_at,
  };
}

function normalizeRawDescriptionSourceShape(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const input = value as Record<string, unknown>;
  return {
    ...input,
    sourceUrl: input.sourceUrl ?? input.source_url,
    fetchedAt: input.fetchedAt ?? input.fetched_at,
    sourceJobId: input.sourceJobId ?? input.source_job_id,
    atsProvider: input.atsProvider ?? input.ats_provider,
    descriptionExcerpt: input.descriptionExcerpt ?? input.description_excerpt,
    fullTextFetchRequired: input.fullTextFetchRequired ?? input.full_text_fetch_required,
  };
}

const workModeSchema = z.string().optional().transform((value) => (
  value === "remote" || value === "hybrid" || value === "onsite" ? value : "remote"
));

const salarySchema = z.object({
  min: z.number().int().nonnegative().nullable(),
  max: z.number().int().nonnegative().nullable(),
  currency: z.literal("USD"),
  period: z.enum(["hour", "year", "unknown"]),
  raw: z.string().trim().max(1000).nullable(),
}).refine((salary) => salary.min === null || salary.max === null || salary.min <= salary.max, {
  message: "Minimum salary must be less than maximum salary.",
  path: ["min"],
});

const emptyJobDescriptionSchema = jobDescriptionSchema.parse({
  summary: "",
  responsibilities: [],
  requiredQualifications: [],
  preferredQualifications: [],
  technologies: [],
  benefits: [],
  education: [],
  experience: [],
  otherRequirements: [],
  sourceUrl: null,
  fetchedAt: null,
  employmentType: null,
  schedule: null,
  travel: null,
});

const emptyRawDescriptionSource = {
  sourceUrl: "https://placeholder.invalid/",
  fetchedAt: "1970-01-01T00:00:00Z",
  sourceJobId: null,
  atsProvider: "unknown" as const,
  descriptionExcerpt: null,
  fullTextFetchRequired: false as const,
};

const jobDescriptionInputSchema = z.preprocess(
  normalizeJobDescriptionShape,
  jobDescriptionSchema.or(z.null()).optional(),
);

const rawDescriptionSourceInputSchema = z.preprocess(
  normalizeRawDescriptionSourceShape,
  rawDescriptionSourceSchema.or(z.null()).optional(),
);

const jobSchema = z.object({
  job_id: z.string().trim().min(1).max(500),
  dedupe_key: z.string().regex(/^[a-f0-9]{64}$/),
  title: z.string().trim().min(1).max(200),
  company: z.string().trim().min(1).max(200),
  location: z.string().trim().min(1).max(500),
  work_arrangement: workModeSchema,
  posting_date: z.string().date().nullable(),
  posting_date_text: z.string().trim().max(1000).nullable(),
  discovered_date: z.string().date().nullable(),
  salary: salarySchema,
  why_match: z.string().trim().max(5000),
  notable_gaps: z.string().trim().max(5000),
  job_description: jobDescriptionInputSchema,
  raw_description_source: rawDescriptionSourceInputSchema,
  apply_url: z.string().trim().url().max(2000),
  canonical_url: z.string().trim().url().max(2000).nullable(),
  source_job_id: z.string().trim().min(1).max(500).nullable(),
}).transform(({ work_arrangement, job_description, raw_description_source, ...job }) => ({
  ...job,
  work_arrangement,
  work_mode: work_arrangement,
  job_description: job_description ?? emptyJobDescriptionSchema,
  raw_description_source: raw_description_source ?? emptyRawDescriptionSource,
}));

const supportedSchemaVersions = ["1.0", "1.1", "1.2"] as const;

export const jobEmailPayloadSchema = z.object({
  schema_version: z.string().refine((value): value is typeof supportedSchemaVersions[number] =>
    (supportedSchemaVersions as readonly string[]).includes(value), {
    message: `Supported schema versions: ${supportedSchemaVersions.join(", ")}`,
  }),
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
    && !((supportedSchemaVersions as readonly string[]).includes((parsedJson as { schema_version?: unknown }).schema_version as string))
  ) {
    throw new JobEmailImportError("JOB_JSON_SCHEMA_UNSUPPORTED", "The job JSON schema version is unsupported.");
  }

  const result = jobEmailPayloadSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new JobEmailImportError("JOB_JSON_VALIDATION_FAILED", "The job JSON payload failed validation.");
  }

  return result.data;
}
