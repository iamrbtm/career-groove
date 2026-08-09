import { z } from "zod";
import type { ParsedJobEmailPayload } from "@/lib/job-email-json/schema";

const bulkImportEntrySchema = z.object({
  jobId: z.string().min(1),
  dedupeKey: z.string().regex(/^[a-f0-9]{64}$/),
  title: z.string().trim().min(1).max(200),
  company: z.string().trim().min(1).max(200),
  location: z.string().trim().min(1).max(200),
  workMode: z.enum(["remote", "hybrid", "onsite"]),
  salaryMin: z.number().int().min(0).nullable(),
  salaryMax: z.number().int().min(0).nullable(),
  salaryCurrency: z.literal("USD"),
  salaryPeriod: z.enum(["hour", "year", "unknown"]),
  salaryRaw: z.string().nullable(),
  sourceUrl: z.string().url(),
  canonicalUrl: z.string().url().nullable(),
  sourceJobId: z.string().nullable(),
  postingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  postingDateText: z.string().nullable(),
  discoveredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  whyMatch: z.string(),
  notableGaps: z.string(),
  description: z.string().min(1).max(50000),
  notes: z.string().max(20000).nullable(),
});

export const inputSchema = z.object({
  searchRunDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  entries: z.array(bulkImportEntrySchema).min(1).max(50),
});

type BulkImportEntry = z.infer<typeof bulkImportEntrySchema>;

export function toJobEmailEntries(entries: readonly BulkImportEntry[]): ParsedJobEmailPayload["jobs"] {
  return entries.map((entry) => ({
    job_id: entry.jobId,
    dedupe_key: entry.dedupeKey,
    title: entry.title,
    company: entry.company,
    location: entry.location,
    work_arrangement: entry.workMode,
    work_mode: entry.workMode,
    posting_date: entry.postingDate,
    posting_date_text: entry.postingDateText,
    discovered_date: entry.discoveredDate,
    salary: {
      min: entry.salaryMin,
      max: entry.salaryMax,
      currency: entry.salaryCurrency,
      period: entry.salaryPeriod,
      raw: entry.salaryRaw,
    },
    why_match: entry.whyMatch,
    notable_gaps: entry.notableGaps,
    apply_url: entry.sourceUrl,
    canonical_url: entry.canonicalUrl,
    source_job_id: entry.sourceJobId,
  }));
}
