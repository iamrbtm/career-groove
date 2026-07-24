import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

const paramsSchema = z.object({ id: z.string().uuid() });
const answerSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  answer: z.string().trim().min(1).max(10000),
  kind: z.enum(["standard_profile", "job_specific"]).default("job_specific"),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
  source: z.string().trim().max(500).optional(),
});
const bodySchema = z.object({
  answers: z.array(answerSchema).max(50),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsedParams = paramsSchema.safeParse(await params);
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedParams.success || !parsedBody.success) return Response.json({ error: "Invalid application answers" }, { status: 400 });

  const updated = await db.query(
    `UPDATE applications
     SET metadata=jsonb_set(metadata, '{applicationAnswers}', $3::jsonb, true),updated_at=now()
     WHERE id=$1 AND user_id=$2
     RETURNING id,metadata`,
    [parsedParams.data.id, user, JSON.stringify({ answers: parsedBody.data.answers, updatedAt: new Date().toISOString() })],
  );
  if (!updated.rowCount) return Response.json({ error: "Application not found" }, { status: 404 });
  await db.query(
    `INSERT INTO application_events(user_id,application_id,event_type,title,body,metadata)
     VALUES($1,$2,'updated','Application answers saved',$3,$4::jsonb)`,
    [
      user,
      parsedParams.data.id,
      `${parsedBody.data.answers.length} answer${parsedBody.data.answers.length === 1 ? "" : "s"} saved for this opportunity.`,
      JSON.stringify({ answerCount: parsedBody.data.answers.length }),
    ],
  );
  return Response.json({ answers: updated.rows[0].metadata.applicationAnswers });
}
