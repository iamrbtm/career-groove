import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";
import { emailMatchParseInputSchema } from "@/lib/email-match-schema";
import { parseJobMatchEmail } from "@/lib/email-match-parser";
import { researchUrl, isSafeUrl } from "@/lib/research";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsed = emailMatchParseInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const { text, enrich = false, useAI = false } = parsed.data;

  try {
    const result = await parseJobMatchEmail({ text, userId: user, useAI });

    if (!enrich) {
      return Response.json({
        header: result.header,
        footer: result.footer,
        jobs: result.jobs,
        enrichmentStatus: "none",
        warnings: result.parseWarnings,
      });
    }

    const enrichmentPromises = result.jobs.map(async (job) => {
      if (!job.applyUrl || !isSafeUrl(job.applyUrl)) {
        return { job, success: false, reason: "No valid URL" };
      }
      try {
        const research = await Promise.race([
          researchUrl(job.applyUrl),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 15000),
          ),
        ]);
        return { job, research, success: true };
      } catch {
        return { job, success: false, reason: "Fetch failed or timed out" };
      }
    });

    const enrichmentResults = await Promise.allSettled(enrichmentPromises);
    const enrichedJobs = result.jobs.map((job, index) => {
      const outcome = enrichmentResults[index];
      if (outcome.status === "fulfilled" && outcome.value.success) {
        const research = (outcome.value as { research: Awaited<ReturnType<typeof researchUrl>> }).research;
        const description = research.rawJobText || job.whyItMatches || job.rawText;
        const confidence = job.confidence === "high" ? "high" : "high";
        return {
          ...job,
          description,
          confidence,
          enrichmentSource: research.companyDomain,
        };
      }
      return { ...job, enrichmentSource: null };
    });

    const successCount = enrichmentResults.filter(
      (r) => r.status === "fulfilled" && (r.value as { success: boolean }).success,
    ).length;

    const enrichmentStatus = successCount === result.jobs.length
      ? "complete"
      : successCount > 0
        ? "partial"
        : "none";

    const warnings = [...result.parseWarnings];
    if (enrichmentStatus === "partial") {
      warnings.push(`${successCount} of ${result.jobs.length} URLs enriched successfully.`);
    } else if (enrichmentStatus === "none" && result.jobs.length > 0) {
      warnings.push("URL enrichment failed for all entries. Using email-parsed data only.");
    }

    return Response.json({
      header: result.header,
      footer: result.footer,
      jobs: enrichedJobs,
      enrichmentStatus,
      warnings,
    });
  } catch (error) {
    console.error("Email parse failed", error);
    return Response.json({ error: "The email could not be parsed." }, { status: 500 });
  }
}
