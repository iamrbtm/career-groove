import { createHash, timingSafeEqual } from "node:crypto";

import { Hono } from "hono";

import type { Database } from "../../db.js";
import type { AppVariables } from "../../http.js";
import { jsonError } from "../../http.js";
import { sendApns, type PushCandidate } from "./apns.js";

interface Candidate extends PushCandidate {
  deviceId: string;
  sourceKey: string;
}

interface Dependencies {
  database: Database;
  secret: string;
  send?: typeof sendApns;
}

function authorized(value: string | undefined, expected: string) {
  if (!value?.startsWith("Bearer ")) return false;
  const actual = createHash("sha256").update(value.slice(7)).digest();
  const wanted = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actual, wanted);
}

export function createNotificationRoutes({
  database,
  secret,
  send = sendApns,
}: Dependencies) {
  const routes = new Hono<{ Variables: AppVariables }>();
  routes.post("/", async (context) => {
    if (!authorized(context.req.header("Authorization"), secret)) {
      return jsonError(context, 401, "unauthorized", "Authentication required");
    }
    const candidates = await database.query<Candidate>(
      `WITH events AS (
        SELECT i.user_id,('interview:'||i.id) AS "sourceKey",
          'interview_reminder' AS category,'Interview coming up' AS title,
          (a.title||' at '||a.company||' is scheduled soon') AS body,
          ('/applications/'||a.id) AS path
        FROM application_interviews i
        JOIN applications a ON a.id=i.application_id
        WHERE i.scheduled_at>now() AND i.scheduled_at<=now()+interval '24 hours'
        UNION ALL
        SELECT a.user_id,('followup:'||a.id||':'||a.follow_up_due_at::date),
          'application_follow_up','Application follow-up due',
          (a.title||' at '||a.company),('/applications/'||a.id)
        FROM applications a
        WHERE a.follow_up_due_at>now()-interval '12 hours'
          AND a.follow_up_due_at<=now()+interval '24 hours'
          AND a.status NOT IN ('rejected','withdrawn','archived')
        UNION ALL
        SELECT j.user_id,('document:'||j.id||':'||j.status),'document_status',
          CASE WHEN j.status='completed' THEN 'Document ready'
            ELSE 'Document needs attention' END,
          CASE WHEN j.status='completed' THEN 'Your generated document is ready.'
            ELSE 'Document generation failed. Open CareerGroove to retry.' END,
          '/documents'
        FROM document_generation_jobs j
        WHERE j.status IN ('completed','failed')
          AND j.completed_at>now()-interval '2 days'
      )
      SELECT d.id AS "deviceId",d.device_token AS "deviceToken",d.environment,
        e."sourceKey",e.category,e.title,e.body,e.path
      FROM events e JOIN push_devices d ON d.user_id=e.user_id
      WHERE d.enabled_categories ? e.category
      ORDER BY e."sourceKey" LIMIT 500`,
    );
    let failed = 0;
    let sent = 0;
    for (const candidate of candidates.rows) {
      const claimed = await database.query<{ id: string }>(
        `INSERT INTO mobile_notification_deliveries(device_id,source_key,category)
         VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id`,
        [candidate.deviceId, candidate.sourceKey, candidate.category],
      );
      const deliveryId = claimed.rows[0]?.id;
      if (!deliveryId) continue;
      try {
        const result = await send(candidate);
        if (result.status === 200) {
          sent += 1;
          await database.query(
            "UPDATE mobile_notification_deliveries SET status='sent',sent_at=now() WHERE id=$1",
            [deliveryId],
          );
        } else {
          failed += 1;
          if ([429, 500, 503].includes(result.status)) {
            await database.query(
              "DELETE FROM mobile_notification_deliveries WHERE id=$1",
              [deliveryId],
            );
          } else {
            await database.query(
              "UPDATE mobile_notification_deliveries SET status='failed',error=$2 WHERE id=$1",
              [deliveryId, `${result.status} ${result.reason ?? "APNs rejected the request"}`],
            );
            if (result.status === 410) {
              await database.query("DELETE FROM push_devices WHERE id=$1", [
                candidate.deviceId,
              ]);
            }
          }
        }
      } catch {
        failed += 1;
        await database.query(
          "DELETE FROM mobile_notification_deliveries WHERE id=$1",
          [deliveryId],
        );
      }
    }
    return context.json({
      candidates: candidates.rowCount ?? candidates.rows.length,
      failed,
      sent,
    });
  });
  return routes;
}
