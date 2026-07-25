import { Hono } from "hono";
import { z } from "zod";

import {
  applicationCreateSchema,
  applicationEventCreateSchema,
  applicationUpdateSchema,
} from "@career-groove/shared";

import type { Database } from "../../db.js";
import type { AppVariables } from "../../http.js";
import { jsonError } from "../../http.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import type { SessionService } from "../auth/session-service.js";

const idSchema = z.string().uuid();
const linkedContactSchema = z
  .object({
    contactId: z.string().uuid().optional(),
    name: z.string().trim().max(160).optional(),
    company: z.string().trim().max(160).optional(),
    role: z.string().trim().max(160).optional(),
    email: z.string().email().or(z.literal("")).optional(),
    phone: z.string().trim().max(60).optional(),
    relationship: z.string().trim().max(160).optional(),
    notes: z.string().trim().max(3_000).optional(),
  })
  .strict()
  .refine((value) => value.contactId || value.name, {
    message: "A contact or name is required",
  });
const submissionSchema = z
  .object({
    appliedAt: z.string().datetime().or(z.literal("")).optional(),
    confirmationNumber: z.string().trim().max(200).optional(),
    applicationUrl: z.string().trim().url().max(2_000).or(z.literal("")).optional(),
    resumeDocumentId: z.string().uuid().optional().nullable(),
    coverLetterDocumentId: z.string().uuid().optional().nullable(),
    contactUsed: z.boolean().default(false),
    followUpDueAt: z.string().datetime().or(z.literal("")).optional(),
    notes: z.string().trim().max(5_000).optional(),
  })
  .strict();
const applicationDocumentSchema = z
  .object({
    documentGenerationJobId: z.string().uuid().optional(),
    kind: z.enum(["resume", "cover_letter", "other"]),
    title: z.string().trim().max(200).optional(),
    status: z.enum(["draft", "generated", "submitted", "archived"]).default("draft"),
    submittedAt: z.string().datetime().or(z.literal("")).optional(),
  })
  .strict();
const interviewSchema = z
  .object({
    roundType: z.string().trim().min(1).max(80).default("screen"),
    scheduledAt: z.string().datetime().or(z.literal("")).optional(),
    interviewer: z.string().trim().max(160).optional(),
    meetingLink: z.string().trim().url().max(2_000).or(z.literal("")).optional(),
    prepStatus: z
      .enum(["not_started", "prepping", "ready", "completed"])
      .default("not_started"),
    notes: z.string().trim().max(5_000).optional(),
  })
  .strict();
const outcomeSchema = z
  .object({
    outcome: z.enum([
      "rejected",
      "no_response",
      "withdrew",
      "offer",
      "accepted",
      "declined",
      "archived",
    ]),
    stage: z.string().trim().max(120).optional(),
    reason: z.string().trim().max(3_000).optional(),
    userNote: z.string().trim().max(5_000).optional(),
    source: z.string().trim().max(120).optional(),
    contactUsed: z.boolean().default(false),
    occurredAt: z.string().datetime().or(z.literal("")).optional(),
    offer: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
const applicationSelect = `
  SELECT a.id,a.status,a.title,a.company,a.location,a.work_mode AS "workMode",
    a.salary_min AS "salaryMin",a.salary_max AS "salaryMax",
    a.salary_currency AS "salaryCurrency",a.source_url AS "sourceUrl",
    a.source,a.description,a.notes,a.priority_label AS "priorityLabel",
    a.next_action_type AS "nextActionType",
    a.next_action_reason AS "nextActionReason",
    a.follow_up_due_at AS "followUpDueAt",a.applied_at AS "appliedAt",
    a.archived_at AS "archivedAt",a.metadata,a.current_step AS "currentStep",
    a.created_at AS "createdAt",a.updated_at AS "updatedAt",
    CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id',s.id,'label',s.label,'fit',s.fit,'readiness',s.readiness,
      'desire',s.desire,'leverage',s.leverage,'risk',s.risk,'timing',s.timing,
      'reasons',s.reasons,'gaps',s.gaps,'nextAction',s.next_action,
      'createdAt',s.created_at
    ) END AS "latestScore"
  FROM applications a
  LEFT JOIN LATERAL (
    SELECT * FROM application_scores
    WHERE user_id=a.user_id AND application_id=a.id
    ORDER BY created_at DESC LIMIT 1
  ) s ON true`;

const updateColumns = {
  appliedAt: "applied_at",
  company: "company",
  description: "description",
  followUpDueAt: "follow_up_due_at",
  location: "location",
  metadata: "metadata",
  nextActionReason: "next_action_reason",
  nextActionType: "next_action_type",
  notes: "notes",
  priorityLabel: "priority_label",
  salaryCurrency: "salary_currency",
  salaryMax: "salary_max",
  salaryMin: "salary_min",
  source: "source",
  sourceUrl: "source_url",
  status: "status",
  title: "title",
  workMode: "work_mode",
} as const;

interface Dependencies {
  database: Database;
  sessions: SessionService;
}

function nullable(value: unknown): unknown {
  return value === "" || value === undefined ? null : value;
}

export function createApplicationRoutes({
  database,
  sessions,
}: Dependencies) {
  const routes = new Hono<{ Variables: AppVariables }>();
  routes.use("*", createAuthMiddleware(sessions));

  routes.get("/", async (context) => {
    const includeArchived =
      context.req.query("includeArchived") === "true";
    const result = await database.query(
      `${applicationSelect}
       WHERE a.user_id=$1 ${
         includeArchived
           ? ""
           : "AND a.archived_at IS NULL AND a.status <> 'archived'"
       }
       ORDER BY a.follow_up_due_at ASC NULLS LAST,a.created_at DESC`,
      [context.get("userId")],
    );
    return context.json({ applications: result.rows });
  });

  routes.post("/", async (context) => {
    const parsed = applicationCreateSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success) {
      return jsonError(
        context,
        400,
        "invalid_application",
        "Invalid application",
        parsed.error.flatten(),
      );
    }
    const input = parsed.data;
    const result = await database.query(
      `WITH inserted AS (
         INSERT INTO applications
          (user_id,title,company,location,work_mode,salary_min,salary_max,
           salary_currency,source_url,source,description,notes,metadata)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
         RETURNING id,status,title,company,location,work_mode AS "workMode",
          salary_min AS "salaryMin",salary_max AS "salaryMax",
          salary_currency AS "salaryCurrency",source_url AS "sourceUrl",
          source,description,notes,priority_label AS "priorityLabel",
          next_action_type AS "nextActionType",
          next_action_reason AS "nextActionReason",
          follow_up_due_at AS "followUpDueAt",applied_at AS "appliedAt",
          archived_at AS "archivedAt",metadata,current_step AS "currentStep",
          created_at AS "createdAt",updated_at AS "updatedAt"
       ), logged AS (
         INSERT INTO application_events
          (user_id,application_id,event_type,title,body,metadata)
         SELECT $1,id,'created','Opportunity saved',$2 || ' at ' || $3,
           jsonb_build_object('status','saved')
         FROM inserted
       )
       SELECT * FROM inserted`,
      [
        context.get("userId"),
        input.title,
        input.company,
        input.location || null,
        input.workMode || null,
        input.salaryMin ?? null,
        input.salaryMax ?? null,
        input.salaryCurrency,
        input.sourceUrl || null,
        input.source || null,
        input.description,
        input.notes || null,
        JSON.stringify(input.metadata),
      ],
    );
    return context.json({ application: result.rows[0] }, 201);
  });

  routes.get("/:id", async (context) => {
    const id = idSchema.safeParse(context.req.param("id"));
    if (!id.success) {
      return jsonError(
        context,
        400,
        "invalid_id",
        "Invalid application id",
      );
    }
    const values = [id.data, context.get("userId")];
    const [application, events, contacts, documents, interviews, outcomes] =
      await Promise.all([
        database.query(`${applicationSelect} WHERE a.id=$1 AND a.user_id=$2`, values),
        database.query(
          `SELECT id,event_type AS "eventType",title,body,
            occurred_at AS "occurredAt",metadata,created_at AS "createdAt"
           FROM application_events WHERE application_id=$1 AND user_id=$2
           ORDER BY occurred_at DESC,created_at DESC`,
          values,
        ),
        database.query(
          `SELECT id,contact_id AS "contactId",name,company,role,email,phone,
            relationship,notes,created_at AS "createdAt",updated_at AS "updatedAt"
           FROM application_contacts WHERE application_id=$1 AND user_id=$2
           ORDER BY updated_at DESC`,
          values,
        ),
        database.query(
          `SELECT id,document_generation_job_id AS "documentGenerationJobId",
            document_id AS "documentId",kind,title,status,
            submitted_at AS "submittedAt",metadata,created_at AS "createdAt"
           FROM application_documents
           WHERE application_id=$1 AND user_id=$2 AND status<>'archived'
           ORDER BY created_at DESC`,
          values,
        ),
        database.query(
          `SELECT id,round_type AS "roundType",scheduled_at AS "scheduledAt",
            interviewer,meeting_link AS "meetingLink",prep_status AS "prepStatus",
            notes,metadata,created_at AS "createdAt",updated_at AS "updatedAt"
           FROM application_interviews WHERE application_id=$1 AND user_id=$2
           ORDER BY scheduled_at NULLS LAST,created_at DESC`,
          values,
        ),
        database.query(
          `SELECT id,outcome,stage,reason,user_note AS "userNote",source,
            contact_used AS "contactUsed",resume_document_id AS "resumeDocumentId",
            cover_letter_document_id AS "coverLetterDocumentId",offer,
            occurred_at AS "occurredAt",created_at AS "createdAt"
           FROM application_outcomes WHERE application_id=$1 AND user_id=$2
           ORDER BY occurred_at DESC,created_at DESC`,
          values,
        ),
      ]);
    if (!application.rows[0]) {
      return jsonError(
        context,
        404,
        "not_found",
        "Application not found",
      );
    }
    return context.json({
      application: application.rows[0],
      contacts: contacts.rows,
      documents: documents.rows,
      events: events.rows,
      interviews: interviews.rows,
      outcomes: outcomes.rows,
    });
  });

  routes.patch("/:id", async (context) => {
    const id = idSchema.safeParse(context.req.param("id"));
    const parsed = applicationUpdateSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!id.success || !parsed.success || Object.keys(parsed.data).length === 0) {
      return jsonError(
        context,
        400,
        "invalid_application",
        "Invalid application update",
      );
    }

    const values: unknown[] = [id.data, context.get("userId")];
    const assignments = Object.entries(parsed.data).map(([key, value]) => {
      const column = updateColumns[key as keyof typeof updateColumns];
      values.push(key === "metadata" ? JSON.stringify(value) : nullable(value));
      return `${column}=$${values.length}${key === "metadata" ? "::jsonb" : ""}`;
    });
    if (parsed.data.status === "archived") {
      assignments.push("archived_at=COALESCE(archived_at,now())");
    }
    if (parsed.data.status === "applied") {
      assignments.push("applied_at=COALESCE(applied_at,now())");
      assignments.push(
        `follow_up_due_at=COALESCE(
          follow_up_due_at,
          now() + (COALESCE(
            (SELECT default_follow_up_days FROM user_job_preferences WHERE user_id=$2),
            7
          )::int || ' days')::interval
        )`,
      );
    }
    const eventType = parsed.data.status ? "status_changed" : "updated";
    const result = await database.query(
      `WITH existing AS (
         SELECT id,status FROM applications WHERE id=$1 AND user_id=$2
       ), updated AS (
         UPDATE applications AS application
         SET ${assignments.join(",")},updated_at=now()
         FROM existing
         WHERE application.id=existing.id AND application.user_id=$2
         RETURNING application.*
       ), logged AS (
         INSERT INTO application_events
          (user_id,application_id,event_type,title,metadata)
         SELECT $2,id,'${eventType}','Opportunity updated','{}'::jsonb
         FROM updated
       )
       SELECT id,status,title,company,location,work_mode AS "workMode",
        salary_min AS "salaryMin",salary_max AS "salaryMax",
        salary_currency AS "salaryCurrency",source_url AS "sourceUrl",
        source,description,notes,priority_label AS "priorityLabel",
        next_action_type AS "nextActionType",
        next_action_reason AS "nextActionReason",
        follow_up_due_at AS "followUpDueAt",applied_at AS "appliedAt",
        archived_at AS "archivedAt",metadata,current_step AS "currentStep",
        created_at AS "createdAt",updated_at AS "updatedAt"
       FROM updated`,
      values,
    );
    if (!result.rows[0]) {
      return jsonError(
        context,
        404,
        "not_found",
        "Application not found",
      );
    }
    return context.json({ application: result.rows[0] });
  });

  routes.delete("/:id", async (context) => {
    const id = idSchema.safeParse(context.req.param("id"));
    if (!id.success) {
      return jsonError(
        context,
        400,
        "invalid_id",
        "Invalid application id",
      );
    }
    const result = await database.query(
      `WITH updated AS (
         UPDATE applications
         SET status='archived',archived_at=COALESCE(archived_at,now()),
           updated_at=now()
         WHERE id=$1 AND user_id=$2 RETURNING id
       ), logged AS (
         INSERT INTO application_events
          (user_id,application_id,event_type,title,metadata)
         SELECT $2,id,'archived','Opportunity archived',
          jsonb_build_object('status','archived')
         FROM updated
       )
       SELECT id FROM updated`,
      [id.data, context.get("userId")],
    );
    if (!result.rowCount) {
      return jsonError(
        context,
        404,
        "not_found",
        "Application not found",
      );
    }
    return context.body(null, 204);
  });

  routes.post("/:id/contacts", async (context) => {
    const id = idSchema.safeParse(context.req.param("id"));
    const parsed = linkedContactSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!id.success || !parsed.success) {
      return jsonError(
        context,
        400,
        "invalid_contact_link",
        "Invalid contact link",
        parsed.success ? undefined : parsed.error.flatten(),
      );
    }
    const input = parsed.data;
    const result = await database.query(
      `WITH owned_application AS (
         SELECT id FROM applications WHERE id=$1 AND user_id=$2
       ), owned_contact AS (
         SELECT id,name,company,role,email,phone FROM contacts
         WHERE id=$3 AND user_id=$2
       ), inserted AS (
         INSERT INTO application_contacts
          (user_id,application_id,contact_id,name,company,role,email,phone,
           relationship,notes)
         SELECT $2,a.id,$3,
          COALESCE(NULLIF($4,''),c.name),COALESCE(NULLIF($5,''),c.company),
          COALESCE(NULLIF($6,''),c.role),COALESCE(NULLIF($7,''),c.email),
          COALESCE(NULLIF($8,''),c.phone),NULLIF($9,''),NULLIF($10,'')
         FROM owned_application a
         LEFT JOIN owned_contact c ON c.id=$3
         WHERE $3::uuid IS NULL OR c.id IS NOT NULL
         RETURNING id,name,company,role,email,phone,relationship,notes,
          created_at AS "createdAt"
       ), logged AS (
         INSERT INTO application_events
          (user_id,application_id,event_type,title,body,metadata)
         SELECT $2,$1,'contact_linked','Contact linked',
          CASE WHEN name IS NULL THEN NULL ELSE name || ' added to this opportunity.' END,
          jsonb_build_object('contactId',$3)
         FROM inserted
       )
       SELECT * FROM inserted`,
      [
        id.data,
        context.get("userId"),
        input.contactId ?? null,
        input.name ?? null,
        input.company ?? null,
        input.role ?? null,
        input.email ?? null,
        input.phone ?? null,
        input.relationship ?? null,
        input.notes ?? null,
      ],
    );
    if (!result.rows[0]) {
      return jsonError(
        context,
        404,
        "not_found",
        "Application or contact not found",
      );
    }
    return context.json({ contact: result.rows[0] }, 201);
  });

  routes.post("/:id/submission", async (context) => {
    const id = idSchema.safeParse(context.req.param("id"));
    const parsed = submissionSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!id.success || !parsed.success) {
      return jsonError(
        context,
        400,
        "invalid_submission",
        "Invalid submission details",
        parsed.success ? undefined : parsed.error.flatten(),
      );
    }
    const input = parsed.data;
    const appliedAt = input.appliedAt || new Date().toISOString();
    const metadata = {
      applicationUrl: input.applicationUrl || null,
      confirmationNumber: input.confirmationNumber || null,
      contactUsed: input.contactUsed,
      coverLetterDocumentId: input.coverLetterDocumentId || null,
      notes: input.notes || null,
      resumeDocumentId: input.resumeDocumentId || null,
      submittedAt: appliedAt,
    };
    const result = await database.query(
      `WITH updated AS (
         UPDATE applications SET status='applied',
          applied_at=COALESCE($3::timestamptz,now()),
          follow_up_due_at=COALESCE($4::timestamptz,follow_up_due_at),
          metadata=jsonb_set(metadata,'{submission}',$5::jsonb,true),
          updated_at=now()
         WHERE id=$1 AND user_id=$2
         RETURNING id,status,applied_at AS "appliedAt",
          follow_up_due_at AS "followUpDueAt",metadata
       ), documents AS (
         UPDATE application_documents SET status='submitted',
          submitted_at=COALESCE(submitted_at,$3::timestamptz),updated_at=now()
         WHERE user_id=$2 AND id IN ($6::uuid,$7::uuid)
       ), logged AS (
         INSERT INTO application_events
          (user_id,application_id,event_type,title,body,metadata)
         SELECT $2,id,'status_changed','Application submitted',$8,$5::jsonb
         FROM updated
       )
       SELECT * FROM updated`,
      [
        id.data,
        context.get("userId"),
        appliedAt,
        input.followUpDueAt || null,
        JSON.stringify(metadata),
        input.resumeDocumentId ?? null,
        input.coverLetterDocumentId ?? null,
        input.notes || input.confirmationNumber || null,
      ],
    );
    if (!result.rows[0]) {
      return jsonError(context, 404, "not_found", "Application not found");
    }
    return context.json({ application: result.rows[0] });
  });

  routes.post("/:id/documents", async (context) => {
    const id = idSchema.safeParse(context.req.param("id"));
    const parsed = applicationDocumentSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!id.success || !parsed.success) {
      return jsonError(context, 400, "invalid_document_link", "Invalid document link");
    }
    const input = parsed.data;
    const result = await database.query(
      `WITH owned_application AS (
         SELECT id FROM applications WHERE id=$1 AND user_id=$2
       ), owned_job AS (
         SELECT id,target_job FROM document_generation_jobs
         WHERE id=$3 AND user_id=$2
       ), inserted AS (
         INSERT INTO application_documents
          (user_id,application_id,document_generation_job_id,kind,title,status,
           submitted_at,metadata)
         SELECT $2,a.id,$3,$4,COALESCE(NULLIF($5,''),j.target_job->>'title'),
          $6,NULLIF($7,'')::timestamptz,jsonb_build_object('fromDocumentJob',$3)
         FROM owned_application a LEFT JOIN owned_job j ON j.id=$3
         WHERE $3::uuid IS NULL OR j.id IS NOT NULL
         RETURNING id,kind,title,status,submitted_at AS "submittedAt",metadata,
          created_at AS "createdAt"
       ), logged AS (
         INSERT INTO application_events
          (user_id,application_id,event_type,title,metadata)
         SELECT $2,$1,'document_linked',
          CASE WHEN $4='cover_letter' THEN 'Cover letter linked'
            WHEN $4='resume' THEN 'Resume linked' ELSE 'Document linked' END,
          jsonb_build_object('kind',$4,'documentGenerationJobId',$3)
         FROM inserted
       )
       SELECT * FROM inserted`,
      [
        id.data,
        context.get("userId"),
        input.documentGenerationJobId ?? null,
        input.kind,
        input.title ?? null,
        input.status,
        input.submittedAt ?? null,
      ],
    );
    if (!result.rows[0]) {
      return jsonError(context, 404, "not_found", "Application or draft not found");
    }
    return context.json({ document: result.rows[0] }, 201);
  });

  routes.post("/:id/interviews", async (context) => {
    const id = idSchema.safeParse(context.req.param("id"));
    const parsed = interviewSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!id.success || !parsed.success) {
      return jsonError(context, 400, "invalid_interview", "Invalid interview details");
    }
    const input = parsed.data;
    const result = await database.query(
      `WITH owned_application AS (
         SELECT id FROM applications WHERE id=$1 AND user_id=$2
       ), inserted AS (
         INSERT INTO application_interviews
          (user_id,application_id,round_type,scheduled_at,interviewer,
           meeting_link,prep_status,notes)
         SELECT $2,id,$3,NULLIF($4,'')::timestamptz,NULLIF($5,''),
          NULLIF($6,''),$7,NULLIF($8,'') FROM owned_application
         RETURNING id,round_type AS "roundType",scheduled_at AS "scheduledAt",
          interviewer,meeting_link AS "meetingLink",prep_status AS "prepStatus",
          notes,metadata,created_at AS "createdAt"
       ), advanced AS (
         UPDATE applications SET
          status=CASE WHEN status IN
            ('saved','researching','ready_to_apply','applied','follow_up')
            THEN 'interviewing' ELSE status END,updated_at=now()
         WHERE id=$1 AND user_id=$2 AND EXISTS (SELECT 1 FROM inserted)
       ), logged AS (
         INSERT INTO application_events
          (user_id,application_id,event_type,title,body,metadata)
         SELECT $2,$1,'interview',initcap($3) || ' interview added',
          CASE WHEN $4='' OR $4 IS NULL THEN 'Interview round recorded'
            ELSE 'Scheduled for ' || $4 END,
          jsonb_build_object('roundType',$3,'interviewer',NULLIF($5,''))
         FROM inserted
       )
       SELECT * FROM inserted`,
      [
        id.data,
        context.get("userId"),
        input.roundType,
        input.scheduledAt ?? null,
        input.interviewer ?? null,
        input.meetingLink ?? null,
        input.prepStatus,
        input.notes ?? null,
      ],
    );
    if (!result.rows[0]) {
      return jsonError(context, 404, "not_found", "Application not found");
    }
    return context.json({ interview: result.rows[0] }, 201);
  });

  routes.post("/:id/outcomes", async (context) => {
    const id = idSchema.safeParse(context.req.param("id"));
    const parsed = outcomeSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!id.success || !parsed.success) {
      return jsonError(context, 400, "invalid_outcome", "Invalid outcome details");
    }
    const input = parsed.data;
    const nextStatus =
      input.outcome === "offer" ||
      input.outcome === "accepted" ||
      input.outcome === "declined"
        ? "offer"
        : input.outcome === "rejected"
          ? "rejected"
          : input.outcome === "withdrew"
            ? "withdrawn"
            : input.outcome === "archived"
              ? "archived"
              : null;
    const result = await database.query(
      `WITH owned_application AS (
         SELECT id,status FROM applications WHERE id=$1 AND user_id=$2
       ), inserted AS (
         INSERT INTO application_outcomes
          (user_id,application_id,outcome,stage,reason,user_note,source,
           contact_used,offer,occurred_at)
         SELECT $2,id,$3,NULLIF($4,''),NULLIF($5,''),NULLIF($6,''),
          NULLIF($7,''),$8,$9::jsonb,COALESCE(NULLIF($10,'')::timestamptz,now())
         FROM owned_application
         RETURNING id,outcome,stage,reason,user_note AS "userNote",source,
          contact_used AS "contactUsed",offer,occurred_at AS "occurredAt",
          created_at AS "createdAt"
       ), advanced AS (
         UPDATE applications SET status=COALESCE($11,status),
          archived_at=CASE WHEN $11='archived'
            THEN COALESCE(archived_at,now()) ELSE archived_at END,updated_at=now()
         WHERE id=$1 AND user_id=$2 AND EXISTS (SELECT 1 FROM inserted)
       ), logged AS (
         INSERT INTO application_events
          (user_id,application_id,event_type,title,body,metadata)
         SELECT $2,$1,'outcome','Outcome logged: ' || replace($3,'_',' '),
          COALESCE(NULLIF($6,''),NULLIF($5,'')),
          jsonb_build_object('outcome',$3,'stage',NULLIF($4,''))
         FROM inserted
       )
       SELECT * FROM inserted`,
      [
        id.data,
        context.get("userId"),
        input.outcome,
        input.stage ?? null,
        input.reason ?? null,
        input.userNote ?? null,
        input.source ?? null,
        input.contactUsed,
        JSON.stringify(input.offer),
        input.occurredAt ?? null,
        nextStatus,
      ],
    );
    if (!result.rows[0]) {
      return jsonError(context, 404, "not_found", "Application not found");
    }
    return context.json({ outcome: result.rows[0] }, 201);
  });

  routes.post("/:id/events", async (context) => {
    const id = idSchema.safeParse(context.req.param("id"));
    const parsed = applicationEventCreateSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!id.success || !parsed.success) {
      return jsonError(context, 400, "invalid_event", "Invalid event");
    }
    const event = parsed.data;
    const result = await database.query(
      `INSERT INTO application_events
        (user_id,application_id,event_type,title,body,occurred_at,metadata)
       SELECT $2,$1,$3,$4,$5,COALESCE($6::timestamptz,now()),$7::jsonb
       WHERE EXISTS (
         SELECT 1 FROM applications WHERE id=$1 AND user_id=$2
       )
       RETURNING id,event_type AS "eventType",title,body,
        occurred_at AS "occurredAt",metadata,created_at AS "createdAt"`,
      [
        id.data,
        context.get("userId"),
        event.eventType,
        event.title,
        event.body || null,
        event.occurredAt || null,
        JSON.stringify(event.metadata),
      ],
    );
    if (!result.rows[0]) {
      return jsonError(
        context,
        404,
        "not_found",
        "Application not found",
      );
    }
    return context.json({ event: result.rows[0] }, 201);
  });

  return routes;
}
