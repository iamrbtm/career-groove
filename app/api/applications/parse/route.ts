import { z } from "zod";

import { requireUser, unauthorized } from "@/lib/api-auth";
import { parseJobPost } from "@/lib/job-post-parser";

const inputSchema = z.object({
  text: z.string().trim().min(20).max(60000),
  sourceUrl: z.string().trim().url().or(z.literal("")).optional(),
  fallbackTitle: z.string().trim().max(200).optional(),
  fallbackCompany: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    return Response.json({ parsed: parseJobPost(parsed.data) });
  } catch (error) {
    console.error("Job post parse failed", error);
    return Response.json({ error: "The job post could not be parsed." }, { status: 500 });
  }
}
