import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";
import { applicationStatusSchema, applicationUpdateSchema, statusLabels } from "@/lib/application-schema";
import { refreshApplicationScore } from "@/lib/tracker-studio";

const idSchema = z.string().uuid();

function valueOrNull(value: unknown) {
  return value === "" || value === undefined ? null : value;
}

async function getApplication(user: string, id: string) {
  const [application, events, contacts, documents, interviews, outcomes] = await Promise.all([
    db.query(
      `SELECT a.id,a.status,a.title,a.company,a.location,a.work_mode AS "workMode",
        a.salary_min AS "salaryMin",a.salary_max AS "salaryMax",a.salary_currency AS "salaryCurrency",
        a.source_url AS "sourceUrl",a.source,a.description,a.notes,a.priority_label AS "priorityLabel",
        a.next_action_type AS "nextActionType",a.next_action_reason AS "nextActionReason",
        a.follow_up_due_at AS "followUpDueAt",a.applied_at AS "appliedAt",a.archived_at AS "archivedAt",
        a.metadata,a.created_at AS "createdAt",a.updated_at AS "updatedAt",
        CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object(
          'id',s.id,'label',s.label,'fit',s.fit,'readiness',s.readiness,'desire',s.desire,
          'leverage',s.leverage,'risk',s.risk,'timing',s.timing,'reasons',s.reasons,'gaps',s.gaps,
          'nextAction',s.next_action,'createdAt',s.created_at
        ) END AS "latestScore"
       FROM applications a
       LEFT JOIN LATERAL (
         SELECT * FROM application_scores
         WHERE user_id=a.user_id AND application_id=a.id
         ORDER BY created_at DESC LIMIT 1
       ) s ON true
       WHERE a.id=$1 AND a.user_id=$2`,
      [id, user],
    ),
    db.query(
      `SELECT id,event_type AS "eventType",title,body,occurred_at AS "occurredAt",metadata,created_at AS "createdAt"
       FROM application_events WHERE application_id=$1 AND user_id=$2
       ORDER BY occurred_at DESC,created_at DESC`,
      [id, user],
    ),
    db.query(
      `SELECT id,name,company,role,email,phone,relationship,notes
       FROM application_contacts WHERE application_id=$1 AND user_id=$2
       ORDER BY updated_at DESC,created_at DESC`,
      [id, user],
    ),
    db.query(
      `SELECT id,document_generation_job_id AS "documentGenerationJobId",document_id AS "documentId",
        kind,title,status,submitted_at AS "submittedAt",metadata,created_at AS "createdAt"
       FROM application_documents WHERE application_id=$1 AND user_id=$2 AND status<>'archived'
       ORDER BY created_at DESC`,
      [id, user],
    ),
    db.query(
      `SELECT id,round_type AS "roundType",scheduled_at AS "scheduledAt",interviewer,meeting_link AS "meetingLink",
        prep_status AS "prepStatus",notes,metadata,created_at AS "createdAt"
       FROM application_interviews WHERE application_id=$1 AND user_id=$2
       ORDER BY scheduled_at NULLS LAST,created_at DESC`,
      [id, user],
    ),
    db.query(
      `SELECT id,outcome,stage,reason,user_note AS "userNote",source,contact_used AS "contactUsed",
        resume_document_id AS "resumeDocumentId",cover_letter_document_id AS "coverLetterDocumentId",
        offer,occurred_at AS "occurredAt",created_at AS "createdAt"
       FROM application_outcomes WHERE application_id=$1 AND user_id=$2
       ORDER BY occurred_at DESC,created_at DESC`,
      [id, user],
    ),
  ]);
  if (!application.rowCount) return null;
  return {
    application: application.rows[0],
    events: events.rows,
    contacts: contacts.rows,
    documents: documents.rows,
    interviews: interviews.rows,
    outcomes: outcomes.rows,
  };
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
    step: "current_step",
    metadata: "metadata",
  };
  const entries = Object.entries(input).filter(([, value]) => value !== undefined);
  if (!entries.length) return Response.json({ error: "No changes supplied" }, { status: 400 });
  const values = entries.map(([key, value]) => key === "metadata" ? JSON.stringify(value) : valueOrNull(value));
  const setters = entries.map(([key], index) => `${columns[key]}=$${index + 3}${key === "metadata" ? "::jsonb" : ""}`);
    if (input.status === "archived") setters.push("archived_at=COALESCE(archived_at,now())");
    if (input.status === "applied") setters.push("applied_at=COALESCE(applied_at,now())");
    if (input.status === "applied") setters.push("follow_up_due_at=COALESCE(follow_up_due_at,now() + (COALESCE((SELECT default_follow_up_days FROM user_job_preferences WHERE user_id=$2),7)::int || ' days')::interval)");

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
    const score = await refreshApplicationScore(client, user, id.data);
    await client.query("COMMIT");
    return Response.json({
      application: {
        ...updated.rows[0],
        priorityLabel: score?.priorityLabel ?? updated.rows[0].priorityLabel,
        nextActionType: score?.nextActionType ?? updated.rows[0].nextActionType,
        nextActionReason: score?.nextActionReason ?? updated.rows[0].nextActionReason,
        latestScore: score?.latestScore ?? null,
      },
      trackerReadiness: score?.trackerReadiness ?? null,
    });
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
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const linked = await client.query(
      `SELECT document_id AS "documentId",document_generation_job_id AS "jobId"
       FROM application_documents WHERE application_id=$1 AND user_id=$2`,
      [id.data, user],
    );
    const deleted = await client.query(
      `DELETE FROM applications WHERE id=$1 AND user_id=$2 RETURNING id`,
      [id.data, user],
    );
    if (!deleted.rowCount) {
      await client.query("ROLLBACK");
      return Response.json({ error: "Application not found" }, { status: 404 });
    }
    const documentIds = linked.rows.map((row) => row.documentId).filter(Boolean);
    const jobIds = linked.rows.map((row) => row.jobId).filter(Boolean);
    if (documentIds.length || jobIds.length) {
      await client.query(
        `DELETE FROM documents
         WHERE user_id=$1
           AND (
             id = ANY($2::uuid[])
             OR content->>'generationJobId' = ANY($3::text[])
           )
           AND NOT EXISTS (
             SELECT 1 FROM application_documents ad
             WHERE ad.document_id = documents.id
                OR ad.document_generation_job_id = ANY($3::text[])
           )`,
        [user, documentIds, jobIds.map(String)],
      );
      if (jobIds.length) {
        await client.query(
          `DELETE FROM document_generation_jobs
           WHERE user_id=$1 AND id = ANY($2::uuid[])
             AND NOT EXISTS (
               SELECT 1 FROM application_documents ad
               WHERE ad.document_generation_job_id = document_generation_jobs.id
             )`,
          [user, jobIds],
        );
      }
    }
    await client.query("COMMIT");
    return new Response(null, { status: 204 });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Application deletion failed", error);
    return Response.json({ error: "The application could not be deleted." }, { status: 500 });
  } finally {
    client.release();
  }
}
