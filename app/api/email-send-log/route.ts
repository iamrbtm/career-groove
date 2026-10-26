import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

/**
 * GET /api/email-send-log
 *
 * Returns the current user's follow-up email send history (most recent first),
 * including the actual recipient, subject and body for successful sends.
 */
export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();

  const result = await db.query(
    `SELECT esl.id, esl.follow_up_id AS "followUpId", esl.application_id AS "applicationId",
            esl.provider, esl.recipient_email AS "recipientEmail", esl.subject, esl.body,
            esl.status, esl.error, esl.provider_message_id AS "providerMessageId",
            esl.created_at AS "createdAt",
            a.title AS "applicationTitle", a.company AS "applicationCompany"
     FROM email_send_log esl
     LEFT JOIN applications a ON a.id = esl.application_id AND a.user_id = esl.user_id
     WHERE esl.user_id=$1
     ORDER BY esl.created_at DESC
     LIMIT 200`,
    [user],
  );

  return Response.json({ logs: result.rows });
}
