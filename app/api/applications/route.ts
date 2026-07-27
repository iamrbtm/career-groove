import { db } from "@/lib/db";
import { requireUser, unauthorized, getUserTier } from "@/lib/api-auth";
import { applicationCreateSchema } from "@/lib/application-schema";
import { parseJobPost } from "@/lib/job-post-parser";
import { buildTrackerReadiness, loadTrackerContext, refreshApplicationScore } from "@/lib/tracker-studio";

const applicationSelect = `
  SELECT a.id,a.status,a.title,a.company,a.location,a.work_mode AS "workMode",
    a.salary_min AS "salaryMin",a.salary_max AS "salaryMax",a.salary_currency AS "salaryCurrency",
    a.source_url AS "sourceUrl",a.source,a.description,a.notes,
    a.priority_label AS "priorityLabel",a.next_action_type AS "nextActionType",
    a.next_action_reason AS "nextActionReason",a.follow_up_due_at AS "followUpDueAt",
    a.applied_at AS "appliedAt",a.archived_at AS "archivedAt",a.metadata,
    a.current_step AS "currentStep",a.created_at AS "createdAt",a.updated_at AS "updatedAt",
    CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id',s.id,'label',s.label,'fit',s.fit,'readiness',s.readiness,
      'desire',s.desire,'leverage',s.leverage,'risk',s.risk,'timing',s.timing,
      'reasons',s.reasons,'gaps',s.gaps,'nextAction',s.next_action,'createdAt',s.created_at
    ) END AS "latestScore"
  FROM applications a
  LEFT JOIN LATERAL (
    SELECT * FROM application_scores
    WHERE user_id=a.user_id AND application_id=a.id
    ORDER BY created_at DESC LIMIT 1
  ) s ON true
`;

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "true";
  const client = await db.connect();
  try {
    const result = await client.query(
      `${applicationSelect}
       WHERE a.user_id=$1 ${includeArchived ? "" : "AND a.archived_at IS NULL AND a.status <> 'archived'"}
       ORDER BY a.follow_up_due_at ASC NULLS LAST,a.created_at DESC`,
      [user],
    );
    const context = await loadTrackerContext(client, user);
    return Response.json({ applications: result.rows, trackerReadiness: buildTrackerReadiness(context) });
  } finally {
    client.release();
  }
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsed = applicationCreateSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const tier = await getUserTier(user);
  if (tier === "free") {
    const count = await db.query(`SELECT COUNT(*) FROM applications WHERE user_id=$1 AND archived_at IS NULL AND status <> 'archived'`, [user]);
    if (parseInt(count.rows[0]?.count || "0", 10) >= 5)
      return Response.json({ error: "Free plan is limited to 5 active roles. Upgrade to Pro for unlimited tracking." }, { status: 403 });
  }
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const parsedJob = parseJobPost({
      text: input.description,
      sourceUrl: input.sourceUrl || undefined,
      fallbackTitle: input.title,
      fallbackCompany: input.company,
    });
    const created = await client.query(
      `INSERT INTO applications(user_id,title,company,location,work_mode,salary_min,salary_max,salary_currency,source_url,source,description,notes,metadata)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
       RETURNING id,status,title,company,location,work_mode AS "workMode",
        salary_min AS "salaryMin",salary_max AS "salaryMax",salary_currency AS "salaryCurrency",
        source_url AS "sourceUrl",source,description,notes,priority_label AS "priorityLabel",
        next_action_type AS "nextActionType",next_action_reason AS "nextActionReason",
        follow_up_due_at AS "followUpDueAt",applied_at AS "appliedAt",archived_at AS "archivedAt",
        metadata,created_at AS "createdAt",updated_at AS "updatedAt"`,
      [
        user,
        input.title,
        input.company,
        input.location || null,
        input.workMode || null,
        input.salaryMin || null,
        input.salaryMax || null,
        input.salaryCurrency,
        input.sourceUrl || null,
        input.source || null,
        input.description,
        input.notes || null,
        JSON.stringify({ ...input.metadata, parsedJob }),
      ],
    );
    await client.query(
      `INSERT INTO application_events(user_id,application_id,event_type,title,body,metadata)
       VALUES($1,$2,'created','Opportunity saved',$3,$4::jsonb)`,
      [user, created.rows[0].id, `${input.title} at ${input.company}`, JSON.stringify({ status: "saved" })],
    );
    const score = await refreshApplicationScore(client, user, created.rows[0].id);
    await client.query("COMMIT");
    return Response.json({
      application: {
        ...created.rows[0],
        priorityLabel: score?.priorityLabel ?? created.rows[0].priorityLabel,
        nextActionType: score?.nextActionType ?? created.rows[0].nextActionType,
        nextActionReason: score?.nextActionReason ?? created.rows[0].nextActionReason,
        latestScore: score?.latestScore ?? null,
      },
      trackerReadiness: score?.trackerReadiness ?? null,
    }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Application creation failed", error);
    return Response.json({ error: "The opportunity could not be saved." }, { status: 500 });
  } finally {
    client.release();
  }
}
