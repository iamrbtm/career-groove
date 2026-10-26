import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { sendAPNsNotification } from "@/lib/apns";
import { buildFollowUpSubject, getDefaultDelay, type FollowUpType, followUpTypes } from "@/lib/follow-up";

function authorized(request: Request) {
  const expected = process.env.FOLLOW_UP_WORKER_SECRET || process.env.MOBILE_NOTIFICATION_WORKER_SECRET;
  const actual = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!expected || !actual) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { checkOverdue, generateDrafts, sendNotifications } = await request.json() as {
    checkOverdue?: boolean; generateDrafts?: boolean; sendNotifications?: boolean;
  };

  const results: string[] = [];

  if (checkOverdue) {
    const overdue = await db.query(
      `SELECT af.id, af.application_id AS "applicationId", af.follow_up_type AS "followUpType",
              af.status, af.scheduled_for AS "scheduledFor",
              a.title AS "appTitle", a.company AS "appCompany", a.user_id AS "userId"
       FROM application_follow_ups af
       JOIN applications a ON a.id = af.application_id AND a.user_id = af.user_id
       WHERE af.user_id=a.user_id
         AND af.status = 'scheduled'
         AND af.scheduled_for <= now()
       ORDER BY af.scheduled_for
       LIMIT 50`,
    );
    const overdueCount = overdue.rowCount ?? 0;
    results.push(`Found ${overdueCount} overdue follow-ups.`);

    if (generateDrafts && overdueCount > 0) {
      let drafted = 0;
      for (const fu of overdue.rows) {
        try {
          const subject = buildFollowUpSubject(fu.followUpType as FollowUpType, fu.appTitle, fu.appCompany);
          await db.query(
            `UPDATE application_follow_ups SET status='draft', subject=$2, updated_at=now()
             WHERE id=$1 AND status='scheduled'`,
            [fu.id, subject],
          );
          drafted++;
        } catch (error) {
          console.error("Failed to mark follow-up as draft:", fu.id, error);
        }
      }
      results.push(`Marked ${drafted} overdue follow-ups as draft.`);
    }

    if (sendNotifications) {
      const pushDevices = await db.query(
        `SELECT DISTINCT ON (pd.user_id) pd.id, pd.device_token, pd.environment, pd.user_id,
                due.ids AS "dueFollowUpIds"
         FROM push_devices pd
         JOIN application_follow_ups af ON af.user_id = pd.user_id
         LEFT JOIN LATERAL (
           SELECT array_agg(d.id)::uuid[] AS ids
           FROM application_follow_ups d
           WHERE d.user_id = pd.user_id
             AND d.status = 'draft'
             AND d.scheduled_for <= now()
             AND (d.reminded_at IS NULL OR d.reminded_at < now() - interval '24 hours')
         ) due ON true
         WHERE af.status IN ('draft') AND af.scheduled_for <= now()
           AND (af.reminded_at IS NULL OR af.reminded_at < now() - interval '24 hours')
         ORDER BY pd.user_id, pd.last_seen_at DESC`,
      );

      let notified = 0;
      for (const device of pushDevices.rows) {
        try {
          await sendAPNsNotification({
            deviceToken: device.device_token,
            environment: device.environment,
            title: "Follow-up reminder",
            body: "You have follow-ups that need attention. Check your dashboard.",
            category: "follow_up_reminder",
            path: "/follow-ups",
          });
          notified++;
        } catch (error) {
          console.error("Failed to send push notification:", error);
          continue;
        }
        if (device.dueFollowUpIds?.length) {
          try {
            await db.query(
              `UPDATE application_follow_ups SET reminded_at = now()
               WHERE id = ANY($1::uuid[]) AND user_id = $2`,
              [device.dueFollowUpIds, device.user_id],
            );
          } catch (error) {
            console.error("Failed to mark follow-ups as reminded:", error);
          }
        }
      }
      results.push(`Sent ${notified} push notifications.`);
    }
  }

  return new Response(results.join(" ") || "No actions performed.");
}
