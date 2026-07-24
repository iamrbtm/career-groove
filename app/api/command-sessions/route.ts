import { z } from "zod";
import type { PoolClient } from "pg";

import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";
import { buildCommandSession, buildTrackerReadiness, loadTrackerContext } from "@/lib/tracker-studio";

const modeSchema = z.object({
  mode: z.enum(["light", "standard", "deep", "recovery", "interview"]).default("standard"),
  refresh: z.boolean().optional(),
});

const applicationSelect = `
  SELECT a.id,a.status,a.title,a.company,a.location,a.work_mode AS "workMode",
    a.salary_min AS "salaryMin",a.salary_max AS "salaryMax",a.source_url AS "sourceUrl",
    a.description,a.notes,a.priority_label AS "priorityLabel",a.next_action_type AS "nextActionType",
    a.next_action_reason AS "nextActionReason",a.follow_up_due_at AS "followUpDueAt",
    a.applied_at AS "appliedAt",a.metadata,a.created_at AS "createdAt"
  FROM applications a
  WHERE a.user_id=$1 AND a.archived_at IS NULL AND a.status <> 'archived'
`;

async function readSession(client: PoolClient, userId: string, sessionId: string) {
  const [sessionResult, actionsResult] = await Promise.all([
    client.query(
      `SELECT id,mode,status,title,recap,started_at AS "startedAt",finished_at AS "finishedAt",created_at AS "createdAt",updated_at AS "updatedAt"
       FROM command_sessions WHERE id=$1 AND user_id=$2`,
      [sessionId, userId],
    ),
    client.query(
      `SELECT id,application_id AS "applicationId",action_type AS "actionType",title,reason,route_target AS "routeTarget",
        status,completed_event_id AS "completedEventId",skip_reason AS "skipReason",position,due_at AS "dueAt",
        completed_at AS "completedAt",created_at AS "createdAt",updated_at AS "updatedAt"
       FROM command_session_actions
       WHERE command_session_id=$1 AND user_id=$2
       ORDER BY position ASC,created_at ASC`,
      [sessionId, userId],
    ),
  ]);
  if (!sessionResult.rowCount) return null;
  return { ...sessionResult.rows[0], actions: actionsResult.rows };
}

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();
  const client = await db.connect();
  try {
    const sessionResult = await client.query(
      `SELECT id FROM command_sessions
       WHERE user_id=$1 AND status='active'
       ORDER BY created_at DESC LIMIT 1`,
      [user],
    );
    const context = await loadTrackerContext(client, user);
    const readiness = buildTrackerReadiness(context);
    const activeSession = sessionResult.rowCount ? await readSession(client, user, sessionResult.rows[0].id) : null;
    return Response.json({ session: activeSession, trackerReadiness: readiness });
  } finally {
    client.release();
  }
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsed = modeSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    if (parsed.data.refresh) {
      await client.query(
        `UPDATE command_sessions SET status='archived',updated_at=now()
         WHERE user_id=$1 AND status='active'`,
        [user],
      );
    }

    const applicationsResult = await client.query(`${applicationSelect} ORDER BY a.follow_up_due_at ASC NULLS LAST,a.created_at DESC`, [user]);
    const context = await loadTrackerContext(client, user);
    const readiness = buildTrackerReadiness(context);
    const plan = buildCommandSession(parsed.data.mode, applicationsResult.rows, readiness);

    const sessionCreated = await client.query(
      `INSERT INTO command_sessions(user_id,mode,title,recap)
       VALUES($1,$2,$3,$4::jsonb)
       RETURNING id,mode,status,title,recap,started_at AS "startedAt",finished_at AS "finishedAt",created_at AS "createdAt",updated_at AS "updatedAt"`,
      [user, plan.mode, plan.title, JSON.stringify({ intro: plan.intro, trackerReadiness: readiness.score })],
    );

    const sessionId = sessionCreated.rows[0].id;
    const actionRows: Array<Record<string, unknown>> = [];
    for (const [index, action] of plan.actions.entries()) {
      const inserted = await client.query(
        `INSERT INTO command_session_actions(user_id,command_session_id,application_id,action_type,title,reason,route_target,position,due_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id,application_id AS "applicationId",action_type AS "actionType",title,reason,route_target AS "routeTarget",
          status,completed_event_id AS "completedEventId",skip_reason AS "skipReason",position,due_at AS "dueAt",
          completed_at AS "completedAt",created_at AS "createdAt",updated_at AS "updatedAt"`,
        [user, sessionId, action.applicationId, action.actionType, action.title, action.reason, action.routeTarget, index, null],
      );
      actionRows.push(inserted.rows[0]);
    }

    await client.query("COMMIT");
    return Response.json({ session: { ...sessionCreated.rows[0], actions: actionRows }, trackerReadiness: readiness }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Command session creation failed", error);
    return Response.json({ error: "The session could not be created." }, { status: 500 });
  } finally {
    client.release();
  }
}
