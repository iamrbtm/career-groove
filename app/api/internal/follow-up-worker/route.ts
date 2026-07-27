import { db } from "@/lib/db";
import { sendAPNsNotification } from "@/lib/apns";
import { buildFollowUpSubject, getDefaultDelay, type FollowUpType, followUpTypes } from "@/lib/follow-up";

const workerSecret = process.env.MOBILE_NOTIFICATION_WORKER_SECRET;

export async function POST(request: Request) {
  const auth = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!workerSecret || auth !== workerSecret) {
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
            `UPDATE application_follow_ups SET status='draft', subject=$3, updated_at=now()
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
        `SELECT DISTINCT ON (pd.user_id) pd.id, pd.device_token, pd.environment, pd.user_id
         FROM push_devices pd
         JOIN application_follow_ups af ON af.user_id = pd.user_id
         WHERE af.status IN ('draft') AND af.scheduled_for <= now()
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
        }
      }
      results.push(`Sent ${notified} push notifications.`);
    }
  }

  return new Response(results.join(" ") || "No actions performed.");
}
