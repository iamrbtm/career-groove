import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";
import { loadTrackerContext, previewApplicationScore } from "@/lib/tracker-studio";

const entrySchema = z.object({
  title: z.string().trim().min(1).max(200),
  company: z.string().trim().min(1).max(200),
  location: z.string().trim().max(200).optional(),
  workMode: z.enum(["remote", "hybrid", "onsite", "flexible", "unknown"]).optional(),
  salaryMin: z.number().int().min(0).optional().nullable(),
  salaryMax: z.number().int().min(0).optional().nullable(),
  description: z.string().min(1).max(50000),
  notes: z.string().max(20000).optional().nullable(),
  sourceUrl: z.string().max(2000).optional().nullable(),
  metadata: z
    .object({
      descriptionSource: z.enum(["scraped", "email-fallback", "unknown"]).optional(),
    })
    .optional(),
});

const inputSchema = z.union([
  z.object({ entry: entrySchema }),
  z.object({ entries: z.array(entrySchema) }),
]);

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const entries = "entry" in parsed.data ? [parsed.data.entry] : parsed.data.entries;

  const client = await db.connect();
  try {
    const context = await loadTrackerContext(client, user);
    const scores = entries.map((entry, index) => {
      const score = previewApplicationScore(entry, context);
      return {
        entryIndex: index,
        fit: score.fit,
        readiness: score.readiness,
        desire: score.desire,
        leverage: score.leverage,
        risk: score.risk,
        timing: score.timing,
        label: score.label,
        reasons: score.reasons,
        gaps: score.gaps,
        nextAction: score.nextAction,
        nextActionReason: score.nextActionReason,
        descriptionSource: entry.metadata?.descriptionSource ?? null,
        descriptionLength: score.contextSnapshot.descriptionLength,
      };
    });
    return Response.json({ scores });
  } catch (error) {
    console.error("Preview score failed", error);
    return Response.json({ error: "Could not compute preview scores." }, { status: 500 });
  } finally {
    client.release();
  }
}
