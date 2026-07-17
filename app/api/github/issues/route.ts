import { z } from "zod";
import { createFeedbackIssue } from "@/lib/github";

export async function POST(request: Request) {
  const parsed = z.object({ title: z.string().min(3).max(200), body: z.string().min(3).max(10000) }).safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const issue = await createFeedbackIssue({ ...parsed.data, labels: ["career-groove-feedback"] });
    return Response.json({ number: issue.number, url: issue.html_url }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "GitHub request failed" }, { status: 500 });
  }
}
