import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({
  confirm: z.boolean().default(false),
  draft: z.object({
    title: z.string().trim().min(1).max(160),
    company: z.string().trim().min(1).max(160),
    location: z.string().trim().max(160).optional().nullable(),
    startedOn: z.string().date().or(z.literal("")).optional().nullable(),
    rawNotes: z.string().trim().max(30000).optional().nullable(),
  }).optional(),
});

function offerStartDate(offer: unknown) {
  if (!offer || typeof offer !== "object") return "";
  const value = (offer as Record<string, unknown>).startDate;
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsedParams = paramsSchema.safeParse(await params);
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsedParams.success || !parsedBody.success) return Response.json({ error: "Invalid conversion request" }, { status: 400 });

  const application = await db.query(
    `SELECT a.id,a.status,a.title,a.company,a.location,a.metadata,
      o.offer
     FROM applications a
     LEFT JOIN LATERAL (
       SELECT offer FROM application_outcomes
       WHERE user_id=a.user_id AND application_id=a.id AND outcome IN ('offer','accepted')
       ORDER BY occurred_at DESC,created_at DESC LIMIT 1
     ) o ON true
     WHERE a.id=$1 AND a.user_id=$2`,
    [parsedParams.data.id, user],
  );
  if (!application.rowCount) return Response.json({ error: "Application not found" }, { status: 404 });
  if (application.rows[0].status !== "offer") return Response.json({ error: "Only accepted offer-stage applications can start a Journey draft." }, { status: 409 });

  const latestAccepted = await db.query(
    `SELECT id FROM application_outcomes
     WHERE user_id=$1 AND application_id=$2 AND outcome='accepted'
     ORDER BY occurred_at DESC,created_at DESC LIMIT 1`,
    [user, parsedParams.data.id],
  );
  if (!latestAccepted.rowCount) return Response.json({ error: "Log an accepted outcome before creating the Journey draft." }, { status: 409 });

  const baseDraft = {
    title: application.rows[0].title,
    company: application.rows[0].company,
    location: application.rows[0].location || "",
    startedOn: offerStartDate(application.rows[0].offer),
    rawNotes: `Seeded from accepted application: ${application.rows[0].title} at ${application.rows[0].company}.`,
  };
  const draft = { ...baseDraft, ...(parsedBody.data.draft || {}) };

  if (!parsedBody.data.confirm) {
    await db.query(
      `UPDATE applications
       SET metadata=jsonb_set(metadata, '{journeyConversionDraft}', $3::jsonb, true),updated_at=now()
       WHERE id=$1 AND user_id=$2`,
      [parsedParams.data.id, user, JSON.stringify({ ...draft, stagedAt: new Date().toISOString() })],
    );
    return Response.json({ draft, staged: true });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT id FROM jobs
       WHERE user_id=$1 AND metadata->>'sourceApplicationId'=$2
       LIMIT 1`,
      [user, parsedParams.data.id],
    );
    if (existing.rowCount) {
      await client.query("ROLLBACK");
      return Response.json({ error: "This application already has a Journey chapter seed.", jobId: existing.rows[0].id }, { status: 409 });
    }
    const created = await client.query(
      `INSERT INTO jobs(user_id,company,title,location,started_on,ended_on,current,raw_notes,achievements,metadata)
       VALUES($1,$2,$3,$4,$5,NULL,true,$6,'[]'::jsonb,$7::jsonb)
       RETURNING id,company,title,location,started_on AS "startedOn",current,raw_notes AS "rawNotes",metadata,created_at AS "createdAt"`,
      [
        user,
        draft.company,
        draft.title,
        draft.location || null,
        draft.startedOn || null,
        draft.rawNotes || baseDraft.rawNotes,
        JSON.stringify({ source: "accepted_application", sourceApplicationId: parsedParams.data.id }),
      ],
    );
    await client.query(
      `UPDATE applications
       SET metadata=jsonb_set(metadata, '{journeyConversion}', $3::jsonb, true),updated_at=now()
       WHERE id=$1 AND user_id=$2`,
      [parsedParams.data.id, user, JSON.stringify({ jobId: created.rows[0].id, createdAt: new Date().toISOString() })],
    );
    await client.query(
      `INSERT INTO application_events(user_id,application_id,event_type,title,body,metadata)
       VALUES($1,$2,'updated','Journey chapter seed created',$3,$4::jsonb)`,
      [user, parsedParams.data.id, `${draft.title} at ${draft.company} was added as a future work chapter.`, JSON.stringify({ jobId: created.rows[0].id })],
    );
    await client.query("COMMIT");
    return Response.json({ job: created.rows[0] }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Application conversion failed", error);
    return Response.json({ error: "The Journey chapter could not be created." }, { status: 500 });
  } finally {
    client.release();
  }
}
