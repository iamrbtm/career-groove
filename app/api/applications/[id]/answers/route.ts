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
  answers: z.array(answerSchema).max(50).optional(),
  rawText: z.string().max(650000).optional(),
}).refine((body) => Boolean(body.rawText?.trim()) || Boolean(body.answers?.length), "Application answers are required.");

function normalizeQuestionKey(question: string) {
  return question
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function parseAnswersText(value: string) {
  const blocks = value.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  return blocks.map((block) => {
    const lines = block.split("\n");
    const read = (label: string) => {
      const line = lines.find((item) => item.toLowerCase().startsWith(`${label.toLowerCase()}:`));
      return line ? line.slice(label.length + 1).trim() : "";
    };
    const question = read("Q") || lines[0]?.trim() || "";
    const answer = read("A") || lines.slice(1).join("\n").trim();
    const confidence = read("Confidence").toLowerCase();
    const kind = read("Kind").toLowerCase().replace(/\s+/g, "_");
    return {
      question,
      answer,
      source: read("Source") || undefined,
      confidence: confidence === "low" || confidence === "high" ? confidence : "medium",
      kind: kind === "standard_profile" ? "standard_profile" : "job_specific",
    };
  }).filter((item) => item.question && item.answer);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsedParams = paramsSchema.safeParse(await params);
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedParams.success || !parsedBody.success) return Response.json({ error: "Invalid application answers" }, { status: 400 });
  const answers = parsedBody.data.rawText?.trim() ? parseAnswersText(parsedBody.data.rawText) : parsedBody.data.answers ?? [];
  const parsedAnswers = z.array(answerSchema).max(50).safeParse(answers);
  if (!parsedAnswers.success || !parsedAnswers.data.length) return Response.json({ error: "Invalid application answers" }, { status: 400 });

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE applications
       SET metadata=jsonb_set(metadata, '{applicationAnswers}', $3::jsonb, true),updated_at=now()
       WHERE id=$1 AND user_id=$2
       RETURNING id,metadata`,
      [parsedParams.data.id, user, JSON.stringify({ answers: parsedAnswers.data, updatedAt: new Date().toISOString() })],
    );
    if (!updated.rowCount) {
      await client.query("ROLLBACK");
      return Response.json({ error: "Application not found" }, { status: 404 });
    }

    await client.query("DELETE FROM application_answers WHERE application_id=$1 AND user_id=$2", [parsedParams.data.id, user]);
    for (const [index, answer] of parsedAnswers.data.entries()) {
      const questionKey = normalizeQuestionKey(answer.question);
      const library = await client.query(
        `INSERT INTO application_answer_library(user_id,question,question_key,canonical_answer,kind,confidence,source,metadata)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
         ON CONFLICT(user_id,question_key) DO UPDATE SET
          question=EXCLUDED.question,
          canonical_answer=EXCLUDED.canonical_answer,
          kind=EXCLUDED.kind,
          confidence=EXCLUDED.confidence,
          source=EXCLUDED.source,
          metadata=application_answer_library.metadata || EXCLUDED.metadata,
          updated_at=now()
         RETURNING id`,
        [
          user,
          answer.question,
          questionKey,
          answer.answer,
          answer.kind,
          answer.confidence,
          answer.source || null,
          JSON.stringify({ lastApplicationId: parsedParams.data.id }),
        ],
      );
      await client.query(
        `INSERT INTO application_answers(user_id,application_id,library_answer_id,question,answer,kind,confidence,source,position,metadata)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
        [
          user,
          parsedParams.data.id,
          library.rows[0].id,
          answer.question,
          answer.answer,
          answer.kind,
          answer.confidence,
          answer.source || null,
          index,
          JSON.stringify({ questionKey }),
        ],
      );
    }
    await client.query(
      `INSERT INTO application_events(user_id,application_id,event_type,title,body,metadata)
       VALUES($1,$2,'updated','Application answers saved',$3,$4::jsonb)`,
      [
        user,
        parsedParams.data.id,
        `${parsedAnswers.data.length} answer${parsedAnswers.data.length === 1 ? "" : "s"} saved for this opportunity.`,
        JSON.stringify({ answerCount: parsedAnswers.data.length }),
      ],
    );
    await client.query("COMMIT");
    return Response.json({ answers: updated.rows[0].metadata.applicationAnswers });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Application answers save failed", error);
    return Response.json({ error: "Application answers could not be saved." }, { status: 500 });
  } finally {
    client.release();
  }
}
