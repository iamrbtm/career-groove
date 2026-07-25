import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

const paramsSchema = z.object({ id: z.string().uuid() });
const inputSchema = z.object({
  roundType: z.string().trim().min(1).max(80).default("screen"),
  scheduledAt: z.string().datetime().or(z.literal("")).optional(),
  interviewer: z.string().trim().max(160).optional(),
  meetingLink: z.string().trim().url().max(2000).or(z.literal("")).optional(),
  prepStatus: z.enum(["not_started", "prepping", "ready", "completed"]).default("not_started"),
  notes: z.string().trim().max(5000).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsedParams = paramsSchema.safeParse(await params);
  const parsedBody = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsedParams.success || !parsedBody.success) {
    return Response.json({ error: "Invalid interview details" }, { status: 400 });
  }

  const exists = await db.query("SELECT id,title,company FROM applications WHERE id=$1 AND user_id=$2", [parsedParams.data.id, user]);
  if (!exists.rowCount) return Response.json({ error: "Application not found" }, { status: 404 });
  const input = parsedBody.data;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const created = await client.query(
      `INSERT INTO application_interviews(user_id,application_id,round_type,scheduled_at,interviewer,meeting_link,prep_status,notes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id,round_type AS "roundType",scheduled_at AS "scheduledAt",interviewer,meeting_link AS "meetingLink",
        prep_status AS "prepStatus",notes,metadata,created_at AS "createdAt"`,
      [
        user,
        parsedParams.data.id,
        input.roundType,
        input.scheduledAt || null,
        input.interviewer || null,
        input.meetingLink || null,
        input.prepStatus,
        input.notes || null,
      ],
    );
    await client.query(
      `INSERT INTO application_events(user_id,application_id,event_type,title,body,metadata)
       VALUES($1,$2,'interview',$3,$4,$5::jsonb)`,
      [
        user,
        parsedParams.data.id,
        `${input.roundType[0].toUpperCase()}${input.roundType.slice(1)} interview added`,
        input.scheduledAt ? `Scheduled for ${input.scheduledAt}` : "Interview round recorded",
        JSON.stringify({ roundType: input.roundType, interviewer: input.interviewer || null }),
      ],
    );
    await client.query(
      `UPDATE applications
       SET status=CASE WHEN status IN ('saved','researching','ready_to_apply','applied','follow_up') THEN 'interviewing' ELSE status END,
         updated_at=now()
       WHERE id=$1 AND user_id=$2`,
      [parsedParams.data.id, user],
    );
    await client.query("COMMIT");
    return Response.json({ interview: created.rows[0] }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Interview creation failed", error);
    return Response.json({ error: "The interview could not be saved." }, { status: 500 });
  } finally {
    client.release();
  }
}
