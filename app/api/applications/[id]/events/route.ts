import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";
import { applicationEventCreateSchema } from "@/lib/application-schema";

const idSchema = z.string().uuid();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const id = idSchema.safeParse((await params).id);
  const parsed = applicationEventCreateSchema.safeParse(await request.json());
  if (!id.success || !parsed.success) return Response.json({ error: "Invalid event" }, { status: 400 });
  const exists = await db.query("SELECT id FROM applications WHERE id=$1 AND user_id=$2", [id.data, user]);
  if (!exists.rowCount) return Response.json({ error: "Application not found" }, { status: 404 });
  const event = parsed.data;
  const created = await db.query(
    `INSERT INTO application_events(user_id,application_id,event_type,title,body,occurred_at,metadata)
     VALUES($1,$2,$3,$4,$5,COALESCE($6::timestamptz,now()),$7::jsonb)
     RETURNING id,event_type AS "eventType",title,body,occurred_at AS "occurredAt",metadata,created_at AS "createdAt"`,
    [user, id.data, event.eventType, event.title, event.body || null, event.occurredAt || null, JSON.stringify(event.metadata)],
  );
  return Response.json({ event: created.rows[0] }, { status: 201 });
}
