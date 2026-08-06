import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();

  const result = await db.query(
    `SELECT
       af.id, af.application_id AS "applicationId",
       af.sequence_number AS "sequenceNumber",
       af.follow_up_type AS "followUpType",
       af.subject, af.message, af.status,
       af.scheduled_for AS "scheduledFor",
       af.delivery_method AS "deliveryMethod",
       af.created_at AS "createdAt",
       af.metadata,
       a.title AS "applicationTitle",
       a.company AS "applicationCompany",
       a.status AS "applicationStatus",
       a.priority_label AS "priorityLabel"
     FROM application_follow_ups af
     JOIN applications a ON a.id = af.application_id AND a.user_id = af.user_id
     WHERE af.user_id=$1
       AND af.status IN ('draft', 'scheduled')
       AND (af.scheduled_for IS NULL OR af.scheduled_for <= now())
     ORDER BY af.scheduled_for ASC NULLS LAST, a.priority_label, a.created_at DESC
     LIMIT 20`,
    [user],
  );

  const dueNow = result.rows.filter((r) => r.scheduledFor && new Date(r.scheduledFor) <= new Date());
  const undrafted = result.rows.filter((r) => !r.scheduledFor);
  const upcoming = await db.query(
    `SELECT
       af.id, af.application_id AS "applicationId",
       af.sequence_number AS "sequenceNumber",
       af.follow_up_type AS "followUpType",
       af.subject, af.status,
       af.scheduled_for AS "scheduledFor",
       af.metadata,
       a.title AS "applicationTitle",
       a.company AS "applicationCompany",
       a.status AS "applicationStatus"
     FROM application_follow_ups af
     JOIN applications a ON a.id = af.application_id AND a.user_id = af.user_id
     WHERE af.user_id=$1
       AND af.status IN ('scheduled')
       AND af.scheduled_for > now()
       AND af.scheduled_for <= now() + interval '7 days'
     ORDER BY af.scheduled_for ASC
     LIMIT 10`,
    [user],
  );

  return Response.json({
    dueNow,
    undrafted,
    upcoming: upcoming.rows,
    totalOverdue: dueNow.length + undrafted.length,
  });
}
