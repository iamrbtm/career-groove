import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

const idSchema = z.string().uuid();
const updateSchema = z.object({
  subject: z.string().max(200).optional(),
  message: z.string().max(10000).optional(),
  status: z.enum(["draft", "scheduled", "sent", "skipped", "failed"]).optional(),
  scheduledFor: z.string().datetime().optional().nullable(),
  deliveryMethod: z.enum(["in_app", "email", "both"]).optional(),
  notes: z.string().max(5000).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const id = idSchema.safeParse((await params).id);
  const parsed = updateSchema.safeParse(await request.json());
  if (!id.success || !parsed.success) return Response.json({ error: "Invalid update." }, { status: 400 });

  const existing = await db.query(
    "SELECT id, status FROM application_follow_ups WHERE id=$1 AND user_id=$2",
    [id.data, user],
  );
  if (!existing.rowCount) return Response.json({ error: "Follow-up not found." }, { status: 404 });

  const input = parsed.data;
  const setters: string[] = [];
  const values: unknown[] = [id.data, user];
  let idx = 3;

  const columns: Record<string, string> = {
    subject: "subject",
    message: "message",
    status: "status",
    scheduledFor: "scheduled_for",
    deliveryMethod: "delivery_method",
    notes: "notes",
  };

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    const col = columns[key];
    if (!col) continue;
    setters.push(`${col}=$${idx}`);
    values.push(value === null ? null : value);
    idx++;
  }

  if (input.status === "sent") {
    setters.push(`sent_at=COALESCE(sent_at,now())`);
  }

  if (setters.length === 0) return Response.json({ error: "No changes." }, { status: 400 });
  setters.push("updated_at=now()");

  const result = await db.query(
    `UPDATE application_follow_ups SET ${setters.join(", ")} WHERE id=$1 AND user_id=$2
     RETURNING id,application_id AS "applicationId",sequence_number AS "sequenceNumber",
      follow_up_type AS "followUpType",subject,message,status,scheduled_for AS "scheduledFor",
      sent_at AS "sentAt",delivery_method AS "deliveryMethod",ai_generated AS "aiGenerated",
      opened_at AS "openedAt",replied_at AS "repliedAt",notes,created_at AS "createdAt"`,
    values,
  );

  if (input.status === "sent") {
    await db.query(
      `INSERT INTO application_events(user_id,application_id,event_type,title,body,metadata)
       VALUES($1,$2,'follow_up','Follow-up sent',$3,$4::jsonb)`,
      [user, existing.rows[0].id, input.subject || "Follow-up message", JSON.stringify({ followUpId: id.data, status: "sent" })],
    );
  }

  return Response.json({ followUp: result.rows[0] });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return Response.json({ error: "Invalid id." }, { status: 400 });

  const result = await db.query(
    "DELETE FROM application_follow_ups WHERE id=$1 AND user_id=$2 RETURNING id",
    [id.data, user],
  );
  if (!result.rowCount) return Response.json({ error: "Not found." }, { status: 404 });
  return new Response(null, { status: 204 });
}
