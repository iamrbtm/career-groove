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

    type EnrichmentOutcome =
      | { status: "fetched"; research: Awaited<ReturnType<typeof researchUrl>> }
      | { status: "no-url" }
      | { status: "unsafe-url" }
      | { status: "cloudflare" }
      | { status: "http-error" }
      | { status: "timeout" };

    function urlVariants(input: string): string[] {
      const variants: string[] = [input];
      try {
        const parsed = new URL(input);
        const swapProto = parsed.protocol === "https:" ? "http:" : "https:";
        const swappedProto = new URL(input);
        swappedProto.protocol = swapProto;
        variants.push(swappedProto.toString());
        if (parsed.hostname.startsWith("www.")) {
          const stripped = new URL(input);
          stripped.hostname = parsed.hostname.slice(4);
          variants.push(stripped.toString());
        } else {
          const withWww = new URL(input);
          withWww.hostname = `www.${parsed.hostname}`;
          variants.push(withWww.toString());
        }
      } catch {
        // leave only the original
      }
      return Array.from(new Set(variants));
    }

    async function enrichWithRetries(applyUrl: string): Promise<EnrichmentOutcome> {
      if (!applyUrl) return { status: "no-url" };
      if (!isSafeUrl(applyUrl)) return { status: "unsafe-url" };
      const attempts = urlVariants(applyUrl);
      const reasons: string[] = [];
      let lastResearch: Awaited<ReturnType<typeof researchUrl>> | null = null;
      for (const variant of attempts) {
        try {
          const research = await Promise.race([
            researchUrl(variant),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Timeout")), 15000),
            ),
          ]);
          lastResearch = research;
          if (research.rawJobText && research.rawJobText.length > 200) {
            return { status: "fetched", research };
          }
          reasons.push(`${variant}: short/empty body`);
        } catch (error) {
          reasons.push(`${variant}: ${error instanceof Error ? error.message : "failed"}`);
        }
      }
      if (lastResearch && (lastResearch.rawJobText || "").length > 0) {
        return { status: "fetched", research: lastResearch };
      }
      console.warn("Email enrichment exhausted", { applyUrl, attempts: reasons });
      return { status: "http-error" };
    }

    const enrichmentPromises = result.jobs.map((job) => enrichWithRetries(job.applyUrl));

    const enrichmentResults = await Promise.all(enrichmentPromises);
    const enrichedJobs = result.jobs.map((job, index) => {
      const outcome = enrichmentResults[index];
      if (outcome.status === "fetched") {
        const research = outcome.research;
        const description = research.rawJobText || job.whyItMatches || job.rawText;
        return {
          ...job,
          description,
          confidence: "high" as const,
          enrichmentSource: research.companyDomain,
        };
      }
      return { ...job, enrichmentSource: null };
    });

    const successCount = enrichmentResults.filter((r) => r.status === "fetched").length;

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
