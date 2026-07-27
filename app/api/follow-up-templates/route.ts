import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

const templateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  triggerEvent: z.enum(["applied", "interview", "no_response", "follow_up"]),
  delayDays: z.number().int().min(0).max(90).default(7),
  subjectTemplate: z.string().min(1).max(300),
  bodyTemplate: z.string().min(1).max(10000),
  aiGenerated: z.boolean().default(false),
});

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();
  const result = await db.query(
    `SELECT id, name, description, trigger_event AS "triggerEvent", delay_days AS "delayDays",
            subject_template AS "subjectTemplate", body_template AS "bodyTemplate",
            ai_generated AS "aiGenerated", active, created_at AS "createdAt"
     FROM follow_up_templates WHERE user_id=$1 ORDER BY trigger_event, delay_days`,
    [user],
  );
  return Response.json({ templates: result.rows });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsed = templateSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;

  const result = await db.query(
    `INSERT INTO follow_up_templates(user_id,name,description,trigger_event,delay_days,subject_template,body_template,ai_generated)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, name, trigger_event AS "triggerEvent", delay_days AS "delayDays", active`,
    [user, input.name, input.description || null, input.triggerEvent, input.delayDays, input.subjectTemplate, input.bodyTemplate, input.aiGenerated],
  );
  return Response.json({ template: result.rows[0] }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "Template id required." }, { status: 400 });

  const body = await request.json();
  const fields: string[] = [];
  const values: unknown[] = [id, user];
  let idx = 3;

  for (const key of ["name", "description", "triggerEvent", "delayDays", "subjectTemplate", "bodyTemplate", "aiGenerated", "active"]) {
    if (body[key] !== undefined) {
      const col = key.replace(/[A-Z]/g, (c: string) => `_${c.toLowerCase()}`);
      fields.push(`${col}=$${idx}`);
      values.push(body[key]);
      idx++;
    }
  }

  if (!fields.length) return Response.json({ error: "No fields to update." }, { status: 400 });
  fields.push("updated_at=now()");

  const result = await db.query(
    `UPDATE follow_up_templates SET ${fields.join(", ")} WHERE id=$1 AND user_id=$2
     RETURNING id, name, trigger_event AS "triggerEvent", delay_days AS "delayDays", active`,
    values,
  );
  if (!result.rowCount) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json({ template: result.rows[0] });
}

export async function DELETE(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "Template id required." }, { status: 400 });

  const result = await db.query("DELETE FROM follow_up_templates WHERE id=$1 AND user_id=$2 RETURNING id", [id, user]);
  if (!result.rowCount) return Response.json({ error: "Not found." }, { status: 404 });
  return new Response(null, { status: 204 });
}
