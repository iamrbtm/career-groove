import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

const paramsSchema = z.object({ id: z.string().uuid() });
const offerSchema = z.object({
  salary: z.number().int().min(0).optional().nullable(),
  bonus: z.number().int().min(0).optional().nullable(),
  benefitsNotes: z.string().trim().max(3000).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  schedule: z.string().trim().max(160).optional().nullable(),
  remotePolicy: z.string().trim().max(160).optional().nullable(),
  startDate: z.string().date().or(z.literal("")).optional().nullable(),
  decisionDeadline: z.string().date().or(z.literal("")).optional().nullable(),
  negotiationStatus: z.string().trim().max(160).optional().nullable(),
}).default({});
const inputSchema = z.object({
  outcome: z.enum(["rejected", "no_response", "withdrew", "offer", "accepted", "declined", "archived"]),
  stage: z.string().trim().max(120).optional(),
  reason: z.string().trim().max(3000).optional(),
  userNote: z.string().trim().max(5000).optional(),
  source: z.string().trim().max(120).optional(),
  contactUsed: z.boolean().optional(),
  resumeDocumentId: z.string().uuid().optional().nullable(),
  coverLetterDocumentId: z.string().uuid().optional().nullable(),
  roleFit: z.enum(["stretch", "fit", "mismatch", "unclear"]).optional(),
  similarStrategy: z.enum(["prioritize", "deprioritize", "neutral"]).optional(),
  occurredAt: z.string().datetime().or(z.literal("")).optional(),
  offer: offerSchema.optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsedParams = paramsSchema.safeParse(await params);
  const parsedBody = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsedParams.success || !parsedBody.success) {
    return Response.json({ error: "Invalid outcome details" }, { status: 400 });
  }

  const existing = await db.query(
    `SELECT id,status,title,company
     FROM applications
     WHERE id=$1 AND user_id=$2`,
    [parsedParams.data.id, user],
  );
  if (!existing.rowCount) return Response.json({ error: "Application not found" }, { status: 404 });
  const input = parsedBody.data;
  const nextStatus = input.outcome === "offer" || input.outcome === "accepted" || input.outcome === "declined"
    ? "offer"
    : input.outcome === "rejected"
      ? "rejected"
      : input.outcome === "withdrew"
        ? "withdrawn"
        : input.outcome === "archived"
          ? "archived"
          : existing.rows[0].status;

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const scoreSnapshot = await client.query(
      `SELECT id
       FROM application_scores
       WHERE application_id=$1 AND user_id=$2
       ORDER BY created_at DESC LIMIT 1`,
      [parsedParams.data.id, user],
    );
    const created = await client.query(
      `INSERT INTO application_outcomes(user_id,application_id,score_snapshot_id,outcome,stage,reason,user_note,source,contact_used,resume_document_id,cover_letter_document_id,role_fit,similar_strategy,offer,occurred_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,COALESCE($15::timestamptz,now()))
       RETURNING id,outcome,stage,reason,user_note AS "userNote",source,contact_used AS "contactUsed",
        role_fit AS "roleFit",similar_strategy AS "similarStrategy",offer,
        occurred_at AS "occurredAt",created_at AS "createdAt"`,
      [
        user,
        parsedParams.data.id,
        scoreSnapshot.rows[0]?.id ?? null,
        input.outcome,
        input.stage || null,
        input.reason || null,
        input.userNote || null,
        input.source || null,
        input.contactUsed ?? false,
        input.resumeDocumentId || null,
        input.coverLetterDocumentId || null,
        input.roleFit ?? null,
        input.similarStrategy ?? null,
        JSON.stringify(input.offer ?? {}),
        input.occurredAt || null,
      ],
    );
    await client.query(
      `INSERT INTO application_events(user_id,application_id,event_type,title,body,metadata)
       VALUES($1,$2,'outcome',$3,$4,$5::jsonb)`,
      [
        user,
        parsedParams.data.id,
        `Outcome logged: ${input.outcome.replace(/_/g, " ")}`,
        input.userNote || input.reason || null,
        JSON.stringify({ outcome: input.outcome, stage: input.stage || null }),
      ],
    );
    await client.query(
      `UPDATE applications
       SET status=$3,
         archived_at=CASE WHEN $3='archived' THEN COALESCE(archived_at,now()) ELSE archived_at END,
         updated_at=now()
       WHERE id=$1 AND user_id=$2`,
      [parsedParams.data.id, user, nextStatus],
    );
    await client.query("COMMIT");
    return Response.json({ outcome: created.rows[0] }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Outcome creation failed", error);
    return Response.json({ error: "The outcome could not be saved." }, { status: 500 });
  } finally {
    client.release();
  }
}
