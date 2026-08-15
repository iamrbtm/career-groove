import { isSafeUrl, researchUrl } from "@/lib/research";
import { humanizeJobDescription } from "@/lib/job-email-json/humanize";
import type { JobDescription, RawDescriptionSource } from "@/lib/application-schema";

export const FETCH_TIMEOUT_MS = 15000;
export const MIN_USABLE_BODY = 200;

export type RawFetchStatus = "fetched" | "unsafe-url" | "timeout" | "no-source";

export type RawFetchOutcome =
  | { status: "fetched"; body: string }
  | { status: "unsafe-url" }
  | { status: "timeout" }
  | { status: "no-source" };

export async function fetchSourceText(sourceUrl: string): Promise<RawFetchOutcome> {
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
    return { status: "fetched", body };
  } catch {
    return { status: "timeout" };
  }
}

/**
 * Pick the best description to store for a job. Priority order:
 *   1. Fetched raw posting body (verbatim from source_url)
 *   2. Humanized structured job_description (summary + bullet lists)
 *   3. LLM-supplied why_match summary
 *   4. Title + Company fallback
 */
export function pickImportDescription(args: {
  rawOutcome: RawFetchOutcome | null;
  jobDescription: JobDescription;
  whyMatch: string;
  title: string;
  company: string;
}): { description: string; rawFetchStatus: RawFetchStatus; used: "fetched" | "humanized" | "summary" | "fallback" } {
  if (args.rawOutcome?.status === "fetched" && args.rawOutcome.body.length > 0) {
    return { description: args.rawOutcome.body, rawFetchStatus: "fetched", used: "fetched" };
  }
  const humanized = humanizeJobDescription(args.jobDescription);
  if (humanized.length > 0) {
    return {
      description: humanized,
      rawFetchStatus: args.rawOutcome?.status === "fetched" ? "fetched" : (args.rawOutcome?.status ?? "no-source"),
      used: "humanized",
    };
  }
  if (args.whyMatch && args.whyMatch.trim().length > 0) {
    return { description: args.whyMatch, rawFetchStatus: args.rawOutcome?.status ?? "no-source", used: "summary" };
  }
  return { description: `${args.title} at ${args.company}`, rawFetchStatus: args.rawOutcome?.status ?? "no-source", used: "fallback" };
}
