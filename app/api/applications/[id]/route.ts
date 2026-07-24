import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";
import { applicationStatusSchema, applicationUpdateSchema, statusLabels } from "@/lib/application-schema";

const idSchema = z.string().uuid();

function valueOrNull(value: unknown) {
  return value === "" || value === undefined ? null : value;
}

async function getApplication(user: string, id: string) {
  const [application, events] = await Promise.all([
    db.query(
      `SELECT id,status,title,company,location,work_mode AS "workMode",
        salary_min AS "salaryMin",salary_max AS "salaryMax",salary_currency AS "salaryCurrency",
        source_url AS "sourceUrl",source,description,notes,priority_label AS "priorityLabel",
        next_action_type AS "nextActionType",next_action_reason AS "nextActionReason",
        follow_up_due_at AS "followUpDueAt",applied_at AS "appliedAt",archived_at AS "archivedAt",
        metadata,created_at AS "createdAt",updated_at AS "updatedAt"
       FROM applications WHERE id=$1 AND user_id=$2`,
      [id, user],
    ),
    db.query(
      `SELECT id,event_type AS "eventType",title,body,occurred_at AS "occurredAt",metadata,created_at AS "createdAt"
       FROM application_events WHERE application_id=$1 AND user_id=$2
       ORDER BY occurred_at DESC,created_at DESC`,
      [id, user],
    ),
  ]);
  if (!application.rowCount) return null;
  return { application: application.rows[0], events: events.rows };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return Response.json({ error: "Invalid application id" }, { status: 400 });
  const result = await getApplication(user, id.data);
  return result ? Response.json(result) : Response.json({ error: "Application not found" }, { status: 404 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const id = idSchema.safeParse((await params).id);
  const parsed = applicationUpdateSchema.safeParse(await request.json());
  if (!id.success || !parsed.success) return Response.json({ error: "Invalid application update" }, { status: 400 });
  const input = parsed.data;
  const existing = await db.query("SELECT status FROM applications WHERE id=$1 AND user_id=$2", [id.data, user]);
  if (!existing.rowCount) return Response.json({ error: "Application not found" }, { status: 404 });
  const currentStatus = applicationStatusSchema.parse(existing.rows[0].status);

  const columns: Record<string, string> = {
    title: "title",
    company: "company",
    location: "location",
    workMode: "work_mode",
    salaryMin: "salary_min",
    salaryMax: "salary_max",
    salaryCurrency: "salary_currency",
    sourceUrl: "source_url",
    source: "source",
    description: "description",
    notes: "notes",
    status: "status",
    priorityLabel: "priority_label",
    nextActionType: "next_action_type",
    nextActionReason: "next_action_reason",
    followUpDueAt: "follow_up_due_at",
    appliedAt: "applied_at",
    metadata: "metadata",
  };
  const entries = Object.entries(input).filter(([, value]) => value !== undefined);
  if (!entries.length) return Response.json({ error: "No changes supplied" }, { status: 400 });
  const values = entries.map(([key, value]) => key === "metadata" ? JSON.stringify(value) : valueOrNull(value));
  const setters = entries.map(([key], index) => `${columns[key]}=$${index + 3}${key === "metadata" ? "::jsonb" : ""}`);
  if (input.status === "archived") setters.push("archived_at=COALESCE(archived_at,now())");
  if (input.status === "applied") setters.push("applied_at=COALESCE(applied_at,now())");

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE applications SET ${setters.join(", ")},updated_at=now()
       WHERE id=$1 AND user_id=$2
       RETURNING id,status,title,company,location,work_mode AS "workMode",
        salary_min AS "salaryMin",salary_max AS "salaryMax",salary_currency AS "salaryCurrency",
        source_url AS "sourceUrl",source,description,notes,priority_label AS "priorityLabel",
        next_action_type AS "nextActionType",next_action_reason AS "nextActionReason",
        follow_up_due_at AS "followUpDueAt",applied_at AS "appliedAt",archived_at AS "archivedAt",
        metadata,created_at AS "createdAt",updated_at AS "updatedAt"`,
      [id.data, user, ...values],
    );
    if (input.status && input.status !== existing.rows[0].status) {
      await client.query(
        `INSERT INTO application_events(user_id,application_id,event_type,title,body,metadata)
         VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
        [
          user,
          id.data,
          input.status === "archived" ? "archived" : "status_changed",
          `Moved to ${statusLabels[input.status]}`,
          `${statusLabels[currentStatus]} -> ${statusLabels[input.status]}`,
          JSON.stringify({ from: currentStatus, to: input.status }),
        ],
      );
    } else {
      await client.query(
        `INSERT INTO application_events(user_id,application_id,event_type,title,metadata)
         VALUES($1,$2,'updated','Opportunity updated',$3::jsonb)`,
        [user, id.data, JSON.stringify({ fields: entries.map(([key]) => key) })],
      );
    }
    await client.query("COMMIT");
    return Response.json({ application: updated.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Application update failed", error);
    return Response.json({ error: "The opportunity could not be updated." }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return Response.json({ error: "Invalid application id" }, { status: 400 });
  const result = await db.query(
    `UPDATE applications SET status='archived',archived_at=COALESCE(archived_at,now()),updated_at=now()
     WHERE id=$1 AND user_id=$2 RETURNING id`,
    [id.data, user],
  );
  if (!result.rowCount) return Response.json({ error: "Application not found" }, { status: 404 });
  await db.query(
    `INSERT INTO application_events(user_id,application_id,event_type,title,metadata)
     VALUES($1,$2,'archived','Opportunity archived',$3::jsonb)`,
    [user, id.data, JSON.stringify({ status: "archived" })],
  );
  return new Response(null, { status: 204 });
}
