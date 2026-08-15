import { z } from "zod";
import { JobEmailImportError } from "@/lib/job-email-json/errors";
import { extractJobJson } from "@/lib/job-email-json/extractor";
import { parseJobEmailPayload } from "@/lib/job-email-json/schema";
import {
  fetchSourceText,
  pickImportDescription,
  type RawFetchOutcome,
  type RawFetchStatus,
} from "@/lib/job-email-json/description";
import type { ResolvedImportJob } from "@/lib/job-email-json/importer";

export { type ResolvedImportJob };

export const freeTierActiveRoleLimit = 5;

export const inputSchema = z.object({
  emailText: z.string().trim().min(1).max(80000),
  selectedJobIds: z.array(z.string().min(1)).min(1).max(50),
});

export async function parseBulkEmailImportRequest(
  input: z.infer<typeof inputSchema>,
): Promise<{ jobs: ResolvedImportJob[]; searchRunDate: string | null; warnings: string[] }> {
  const payload = parseJobEmailPayload(extractJobJson(input.emailText));
  const selectedJobIds = new Set(input.selectedJobIds);
  const filtered = payload.jobs.filter((job) => selectedJobIds.has(job.job_id));

  if (filtered.length !== selectedJobIds.size) {
    throw new JobEmailImportError(
      "JOB_JSON_VALIDATION_FAILED",
      "One or more selected jobs are not in the JSON block.",
    );
  }

  const rawOutcomes = await Promise.all(
    filtered.map(async (job) => {
      if (!job.raw_description_source.fullTextFetchRequired) {
        return { status: "no-source" as const };
      }
      return fetchSourceText(job.raw_description_source.sourceUrl);
    }),
  );

  const warnings: string[] = [];
  const jobs: ResolvedImportJob[] = filtered.map((job, index) => {
    const rawOutcome = rawOutcomes[index];
    const resolution = pickImportDescription({
      rawOutcome,
      jobDescription: job.job_description,
      whyMatch: job.why_match,
      title: job.title,
      company: job.company,
    });

    if (rawOutcome.status === "timeout") {
      warnings.push(`${job.company} – ${job.title}: could not fetch the original posting within 15s; using the structured description.`);
    } else if (rawOutcome.status === "unsafe-url") {
      warnings.push(`${job.company} – ${job.title}: source URL blocked from auto-fetch; using the structured description.`);
    }

    return {
      job,
      description: resolution.description,
      descriptionSource: resolution.used,
    };
  });

  return { jobs, searchRunDate: payload.search_run_date, warnings };
}

export function exceedsFreeTierImportLimit(activeCount: number, selectedJobCount: number) {
  return activeCount + selectedJobCount > freeTierActiveRoleLimit;
}

// Exported so importers can still introspect fetch status if they ever need it.
export type { RawFetchOutcome, RawFetchStatus };
