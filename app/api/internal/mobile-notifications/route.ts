import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { sendAPNsNotification } from "@/lib/apns";

type Candidate = {
  deviceId: string;
  deviceToken: string;
  environment: "sandbox" | "production";
  sourceKey: string;
  category: string;
  title: string;
  body: string;
  path: string | null;
};

function authorized(request: Request) {
  const expected = process.env.MOBILE_NOTIFICATION_WORKER_SECRET;
  const actual = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!expected || !actual) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const candidates = await db.query<Candidate>(
    `WITH events AS (
      SELECT i.user_id,('interview:'||i.id) AS "sourceKey",'interview_reminder' AS category,
        'Interview coming up' AS title,
        (a.title||' at '||a.company||' is scheduled for '||to_char(i.scheduled_at,'Mon DD at HH12:MI AM')) AS body,
        ('/applications/'||a.id) AS path
      FROM application_interviews i JOIN applications a ON a.id=i.application_id
      WHERE i.scheduled_at > now() AND i.scheduled_at <= now() + interval '24 hours'
      UNION ALL
      SELECT a.user_id,('followup:'||a.id||':'||a.follow_up_due_at::date),'application_follow_up',
        'Application follow-up due',(a.title||' at '||a.company),('/applications/'||a.id)
      FROM applications a
      WHERE a.follow_up_due_at > now() - interval '12 hours' AND a.follow_up_due_at <= now() + interval '24 hours'
        AND a.status NOT IN ('rejected','withdrawn','archived')
      UNION ALL
      SELECT j.user_id,('document:'||j.id||':'||j.status),'document_status',
        CASE WHEN j.status='completed' THEN 'Document ready' ELSE 'Document needs attention' END,
        CASE WHEN j.status='completed' THEN 'Your generated document is ready.' ELSE 'Document generation failed. Open Career Groove to retry.' END,
        '/documents'
      FROM document_generation_jobs j
      WHERE j.status IN ('completed','failed') AND j.completed_at > now() - interval '2 days'
      UNION ALL
      SELECT a.user_id,('command:'||a.id),'command_session_action','Your next move is ready',
        a.title,a.route_target
      FROM command_session_actions a
      WHERE a.status='pending' AND a.created_at > now() - interval '2 days'
        AND (a.due_at IS NULL OR a.due_at <= now() + interval '24 hours')
      UNION ALL
      SELECT u.id,('subscription:'||COALESCE(u."appStoreExpiresAt"::date::text,u.updated_at::date::text)),
        'subscription_status','Subscription needs attention',
        'Open billing to review your Career Groove subscription.','/settings/billing'
      FROM users u
      WHERE (u."subscriptionStatus" IN ('past_due','unpaid')
        OR (u."appStoreExpiresAt" < now() AND u."appStoreExpiresAt" > now() - interval '2 days'))
    )
    SELECT d.id AS "deviceId",d.device_token AS "deviceToken",d.environment,
      e."sourceKey",e.category,e.title,e.body,e.path
    FROM events e JOIN push_devices d ON d.user_id=e.user_id
    WHERE d.enabled_categories ? e.category
    ORDER BY e."sourceKey" LIMIT 500`,
  );

  let sent = 0;
  let failed = 0;
  for (const candidate of candidates.rows) {
    const claimed = await db.query(
      `INSERT INTO mobile_notification_deliveries(device_id,source_key,category)
       VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id`,
      [candidate.deviceId, candidate.sourceKey, candidate.category],
    );
    if (!claimed.rowCount) continue;
    const deliveryId = claimed.rows[0].id;
    try {
      const result = await sendAPNsNotification({
        deviceToken: candidate.deviceToken,
        environment: candidate.environment,
        title: candidate.title,
        body: candidate.body,
        category: candidate.category,
        path: candidate.path ?? undefined,
      });
      if (result.status === 200) {
        sent += 1;
        await db.query(
          "UPDATE mobile_notification_deliveries SET status='sent',sent_at=now() WHERE id=$1",
          [deliveryId],
        );
      } else {
        failed += 1;
        if ([429, 500, 503].includes(result.status)) {
          await db.query("DELETE FROM mobile_notification_deliveries WHERE id=$1", [deliveryId]);
        } else {
          await db.query(
            "UPDATE mobile_notification_deliveries SET status='failed',error=$2 WHERE id=$1",
            [deliveryId, `${result.status} ${result.reason ?? "APNs rejected the request"}`],
          );
          if (result.status === 410) await db.query("DELETE FROM push_devices WHERE id=$1", [candidate.deviceId]);
        }
      }
    } catch (error) {
      failed += 1;
      console.error("APNs delivery failed", error);
      await db.query("DELETE FROM mobile_notification_deliveries WHERE id=$1", [deliveryId]);
    }
  }
  return Response.json({ candidates: candidates.rowCount, sent, failed });
}
