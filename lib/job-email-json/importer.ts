import type { ParsedJobEmailPayload } from "@/lib/job-email-json/schema";

type ParsedJobEmailEntry = ParsedJobEmailPayload["jobs"][number];

export type JobEmailImportClient = {
  query(queryText: string, values?: unknown[]): Promise<{ rowCount: number | null; rows: unknown[] }>;
};

export type JobEmailImportResult = {
  jobsReceived: number;
  jobsCreated: number;
  duplicatesSkipped: number;
  jobsFailed: number;
  jobs: Array<{
    jobId: string;
    status: "created" | "duplicate" | "failed";
    reason?: string;
  }>;
};

export type JobEmailImportOptions = {
  searchRunDate: string | null;
};

function descriptionFor(job: ParsedJobEmailEntry) {
  return job.why_match || `${job.title} at ${job.company}`;
}

function notesFor(job: ParsedJobEmailEntry) {
  return job.notable_gaps || null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The job could not be imported.";
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === "23505";
}

async function importJobEmailEntry(
  client: JobEmailImportClient,
  userId: string,
  job: ParsedJobEmailEntry,
  options: JobEmailImportOptions,
): Promise<JobEmailImportResult["jobs"][number]> {
  try {
    const existing = await client.query(
      `SELECT id FROM applications
       WHERE user_id = $1
         AND (
           (dedupe_key IS NOT NULL AND dedupe_key = $2)
           OR ($3::text IS NOT NULL AND source_job_id = $3 AND lower(company) = lower($4))
           OR ($5::text IS NOT NULL AND canonical_url = $5)
         )
       LIMIT 1`,
      [userId, job.dedupe_key, job.source_job_id, job.company, job.canonical_url],
    );
    if (existing.rowCount) return { jobId: job.job_id, status: "duplicate" };

    await client.query(
      `INSERT INTO applications (
         user_id, title, company, location, work_mode, salary_min, salary_max, salary_currency,
         salary_period, salary_raw, source_url, canonical_url, source_job_id, dedupe_key,
         posting_date, posting_date_text, discovered_date, search_run_date,
         description, notes, source, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::jsonb)`,
      [
        userId,
        job.title,
        job.company,
        job.location,
        job.work_mode,
        job.salary.min,
        job.salary.max,
        job.salary.currency,
        job.salary.period,
        job.salary.raw,
        job.apply_url,
        job.canonical_url,
        job.source_job_id,
        job.dedupe_key,
        job.posting_date,
        job.posting_date_text,
        job.discovered_date,
        options.searchRunDate,
        descriptionFor(job),
        notesFor(job),
        "email_json_import",
        JSON.stringify({ jobId: job.job_id, whyMatch: job.why_match, notableGaps: job.notable_gaps }),
      ],
    );
    return { jobId: job.job_id, status: "created" };
  } catch (error) {
    if (isUniqueViolation(error)) return { jobId: job.job_id, status: "duplicate" };
    return { jobId: job.job_id, status: "failed", reason: errorMessage(error) };
  }
}

export async function importJobEmailEntries(
  client: JobEmailImportClient,
  userId: string,
  entries: readonly ParsedJobEmailEntry[],
  options: JobEmailImportOptions,
): Promise<JobEmailImportResult> {
  const jobs = [] as JobEmailImportResult["jobs"];
  for (const entry of entries) jobs.push(await importJobEmailEntry(client, userId, entry, options));

  return {
    jobsReceived: entries.length,
    jobsCreated: jobs.filter((job) => job.status === "created").length,
    duplicatesSkipped: jobs.filter((job) => job.status === "duplicate").length,
    jobsFailed: jobs.filter((job) => job.status === "failed").length,
    jobs,
  };
}
