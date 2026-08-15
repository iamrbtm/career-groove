import { requireUser, unauthorized } from "@/lib/api-auth";
import { humanizeJobDescription } from "@/lib/job-email-json/humanize";
import { isSafeUrl, researchUrl } from "@/lib/research";
import { JobEmailImportError } from "@/lib/job-email-json/errors";
import { extractJobJson } from "@/lib/job-email-json/extractor";
import { parseEmailImportInput, parseJobEmailPayload } from "@/lib/job-email-json/schema";

const FETCH_TIMEOUT_MS = 15000;
const MIN_USABLE_BODY = 200;

type FetchOutcome =
  | { status: "fetched"; body: string }
  | { status: "unsafe-url" }
  | { status: "timeout" }
  | { status: "short-body"; body: string }
  | { status: "no-source" };

async function fetchFullText(sourceUrl: string): Promise<FetchOutcome> {
  if (!sourceUrl) return { status: "no-source" };
  if (!isSafeUrl(sourceUrl)) return { status: "unsafe-url" };
  try {
    const research = await Promise.race([
      researchUrl(sourceUrl),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Fetch timeout")), FETCH_TIMEOUT_MS),
      ),
    ]);
    const body = (research.rawJobText || "").trim();
    if (body.length >= MIN_USABLE_BODY) return { status: "fetched", body };
    return { status: "short-body", body };
  } catch {
    return { status: "timeout" };
  }
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsed = parseEmailImportInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const jsonText = extractJobJson(parsed.data.text);
    const payload = parseJobEmailPayload(jsonText);

    const fetchOutcomes = await Promise.all(
      payload.jobs.map(async (job) => {
        if (!job.raw_description_source.fullTextFetchRequired) {
          return { status: "no-source" as const };
        }
        return fetchFullText(job.raw_description_source.sourceUrl);
      }),
    );

    const warnings: string[] = [];
    const jobs = payload.jobs.map((job, index) => {
      const outcome = fetchOutcomes[index];
      let fullDescription: string | null = null;
      let humanized: string | null = null;
      let rawFetchStatus: "fetched" | "no-source" | "unsafe-url" | "timeout" | "short-body" = "no-source";

      if (outcome.status === "fetched") {
        fullDescription = outcome.body;
        rawFetchStatus = "fetched";
      } else if (outcome.status === "short-body") {
        fullDescription = humanizeJobDescription(job.job_description);
        rawFetchStatus = "short-body";
        warnings.push(`${job.company} – ${job.title}: source returned a short body; using the structured description instead.`);
      } else {
        humanized = humanizeJobDescription(job.job_description);
        if (humanized.length >= MIN_USABLE_BODY) fullDescription = humanized;
        rawFetchStatus = outcome.status === "no-source" ? "no-source" : outcome.status;
        if (outcome.status === "timeout") {
          warnings.push(`${job.company} – ${job.title}: could not fetch the original posting within ${FETCH_TIMEOUT_MS / 1000}s.`);
        } else if (outcome.status === "unsafe-url") {
          warnings.push(`${job.company} – ${job.title}: source URL blocked from auto-fetch.`);
        }
      }

      return {
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
        jobDescription: job.job_description,
        humanizedDescription: humanized,
        fullDescription,
        rawFetchStatus,
        applyUrl: job.apply_url,
        canonicalUrl: job.canonical_url,
        sourceJobId: job.source_job_id,
        rawDescriptionSource: job.raw_description_source,
      };
    });

    return Response.json({
      header: payload.generated_at,
      footer: payload.search_run_date,
      jobs,
      warnings,
    });
  } catch (error) {
    if (error instanceof JobEmailImportError) {
      return Response.json({ error: error.message, code: error.code }, { status: 400 });
    }
    console.error("Email parse failed", error);
    return Response.json({ error: "The email could not be parsed." }, { status: 500 });
  }
}
