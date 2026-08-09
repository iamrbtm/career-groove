import { requireUser, unauthorized } from "@/lib/api-auth";
import { JobEmailImportError } from "@/lib/job-email-json/errors";
import { extractJobJson } from "@/lib/job-email-json/extractor";
import { parseEmailImportInput, parseJobEmailPayload } from "@/lib/job-email-json/schema";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsed = parseEmailImportInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const jsonText = extractJobJson(parsed.data.text);
    const payload = parseJobEmailPayload(jsonText);

    return Response.json({
      header: payload.generated_at,
      footer: payload.search_run_date,
      jobs: payload.jobs.map((job) => ({
        jobId: job.job_id,
        dedupeKey: job.dedupe_key,
        title: job.title,
        company: job.company,
        location: job.location,
        workArrangement: job.work_arrangement,
        postingDate: job.posting_date,
        postingDateText: job.posting_date_text,
        discoveredDate: job.discovered_date,
        salary: job.salary,
        whyMatch: job.why_match,
        notableGaps: job.notable_gaps,
        applyUrl: job.apply_url,
        canonicalUrl: job.canonical_url,
        sourceJobId: job.source_job_id,
      })),
      warnings: [],
    });
  } catch (error) {
    if (error instanceof JobEmailImportError) {
      return Response.json({ error: error.message, code: error.code }, { status: 400 });
    }
    console.error("Email parse failed", error);
    return Response.json({ error: "The email could not be parsed." }, { status: 500 });
  }
}
