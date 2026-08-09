import { z } from "zod";
import { JobEmailImportError } from "@/lib/job-email-json/errors";
import { extractJobJson } from "@/lib/job-email-json/extractor";
import { parseJobEmailPayload } from "@/lib/job-email-json/schema";

export const freeTierActiveRoleLimit = 5;

export const inputSchema = z.object({
  emailText: z.string().trim().min(1).max(80000),
  selectedJobIds: z.array(z.string().min(1)).min(1).max(50),
});

export function parseBulkEmailImportRequest(input: z.infer<typeof inputSchema>) {
  const payload = parseJobEmailPayload(extractJobJson(input.emailText));
  const selectedJobIds = new Set(input.selectedJobIds);
  const jobs = payload.jobs.filter((job) => selectedJobIds.has(job.job_id));

  if (jobs.length !== selectedJobIds.size) {
    throw new JobEmailImportError(
      "JOB_JSON_VALIDATION_FAILED",
      "One or more selected jobs are not in the JSON block.",
    );
  }

  return { jobs, searchRunDate: payload.search_run_date };
}

export function exceedsFreeTierImportLimit(activeCount: number, selectedJobCount: number) {
  return activeCount + selectedJobCount > freeTierActiveRoleLimit;
}
