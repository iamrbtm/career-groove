import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

const paramsSchema = z.object({
  id: z.string().uuid(),
  actionId: z.string().uuid(),
});

const bodySchema = z.object({
  status: z.enum(["completed", "skipped", "snoozed"]),
  skipReason: z.string().trim().max(500).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; actionId: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsedParams = paramsSchema.safeParse(await params);
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedParams.success || !parsedBody.success) {
    return Response.json({ error: "Invalid action update" }, { status: 400 });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT a.id,a.application_id AS "applicationId",a.action_type AS "actionType",a.title,a.reason,a.route_target AS "routeTarget",a.status,
        s.id AS "sessionId",s.status AS "sessionStatus"
       FROM command_session_actions a
       JOIN command_sessions s ON s.id=a.command_session_id
       WHERE a.id=$1 AND a.command_session_id=$2 AND a.user_id=$3`,
      [parsedParams.data.actionId, parsedParams.data.id, user],
    );
    if (!existing.rowCount) {
      await client.query("ROLLBACK");
      return Response.json({ error: "Action not found" }, { status: 404 });
    }

    let completedEventId: string | null = null;
    if (parsedBody.data.status === "completed" && existing.rows[0].applicationId) {
      let nextStatus: string | null = null;
      switch (existing.rows[0].actionType) {
        case "apply":
          nextStatus = "applied";
          break;
        case "follow_up":
          nextStatus = "follow_up";
          break;
        case "prep_interview":
          nextStatus = "interviewing";
          break;
        case "compare_offer":
          nextStatus = "offer";
          break;
        case "archive_role":
          nextStatus = "archived";
          break;
        default:
          nextStatus = null;
      }
      const event = await client.query(
        `INSERT INTO application_events(user_id,application_id,event_type,title,body,metadata)
         VALUES($1,$2,'updated',$3,$4,$5::jsonb)
         RETURNING id`,
        [
          user,
          existing.rows[0].applicationId,
          `Setlist action completed: ${existing.rows[0].title}`,
          existing.rows[0].reason,
          JSON.stringify({ actionType: existing.rows[0].actionType, sessionId: parsedParams.data.id }),
        ],
      );
      completedEventId = event.rows[0].id;
      if (nextStatus) {
        await client.query(
          `UPDATE applications
           SET status=$3,
             applied_at=CASE WHEN $3='applied' THEN COALESCE(applied_at,now()) ELSE applied_at END,
             archived_at=CASE WHEN $3='archived' THEN COALESCE(archived_at,now()) ELSE archived_at END,
             updated_at=now()
           WHERE id=$1 AND user_id=$2`,
          [existing.rows[0].applicationId, user, nextStatus],
        );
      }
    }

    const updated = await client.query(
      `UPDATE command_session_actions
       SET status=$4,skip_reason=$5,completed_at=CASE WHEN $4='completed' THEN now() ELSE completed_at END,
         completed_event_id=COALESCE($6,completed_event_id),updated_at=now()
       WHERE id=$1 AND command_session_id=$2 AND user_id=$3
       RETURNING id,application_id AS "applicationId",action_type AS "actionType",title,reason,route_target AS "routeTarget",
        status,completed_event_id AS "completedEventId",skip_reason AS "skipReason",position,due_at AS "dueAt",
        completed_at AS "completedAt",created_at AS "createdAt",updated_at AS "updatedAt"`,
      [parsedParams.data.actionId, parsedParams.data.id, user, parsedBody.data.status, parsedBody.data.skipReason ?? null, completedEventId],
    );

    const pending = await client.query(
      `SELECT count(*)::int AS count
       FROM command_session_actions
       WHERE command_session_id=$1 AND user_id=$2 AND status='pending'`,
      [parsedParams.data.id, user],
    );
    if ((pending.rows[0]?.count ?? 0) === 0) {
      await client.query(
        `UPDATE command_sessions
         SET status='finished',finished_at=now(),updated_at=now()
         WHERE id=$1 AND user_id=$2`,
        [parsedParams.data.id, user],
      );
    }

    await client.query("COMMIT");
    return Response.json({ action: updated.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Command session action update failed", error);
    return Response.json({ error: "The action could not be updated." }, { status: 500 });
  } finally {
    client.release();
  }
}
