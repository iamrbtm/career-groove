import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";
import { sendEmail } from "@/lib/email";
import { getActiveEmailConnection } from "@/lib/email";

const idSchema = z.string().uuid();
const bodySchema = z.object({
  recipientEmail: z.string().email(),
});

/**
 * POST /api/follow-ups/[id]/send-email
 *
 * Sends the follow-up message via the user's active email connection.
 * If the application has a linked resume document it is fetched and
 * attached. The follow-up is then marked as sent.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const id = idSchema.safeParse((await params).id);
  const parsed = bodySchema.safeParse(await request.json());
  if (!id.success || !parsed.success) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  // Load follow-up + application
  const fuRow = await db.query(
    `SELECT af.id, af.application_id AS "applicationId", af.follow_up_type AS "followUpType",
            af.subject, af.message, af.status,
            a.title AS "applicationTitle", a.company AS "applicationCompany"
     FROM application_follow_ups af
     JOIN applications a ON a.id = af.application_id AND a.user_id = af.user_id
     WHERE af.id=$1 AND af.user_id=$2`,
    [id.data, user],
  );
  if (!fuRow.rowCount) return Response.json({ error: "Follow-up not found." }, { status: 404 });

  const fu = fuRow.rows[0];
  if (!fu.message) {
    return Response.json({ error: "No message drafted yet. Generate an AI draft first." }, { status: 422 });
  }

  // Load active email connection
  const connection = await getActiveEmailConnection(user);
  if (!connection) {
    return Response.json(
      { error: "No active email connection. Configure one in Settings → Email." },
      { status: 422 },
    );
  }

  // Look for a linked resume document
  const resumeRow = await db.query(
    `SELECT ad.id, d.title, d.content
     FROM application_documents ad
     JOIN documents d ON d.id = ad.document_id AND d.user_id = ad.user_id
     WHERE ad.user_id=$1 AND ad.application_id=$2 AND ad.kind='resume'
       AND ad.status != 'archived'
     ORDER BY ad.created_at DESC
     LIMIT 1`,
    [user, fu.applicationId],
  );

  const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
  if (resumeRow.rowCount) {
    const doc = resumeRow.rows[0];
    const resumeTitle: string = (doc.title as string) || `Resume - ${fu.applicationTitle}`;
    // document content is stored as JSONB; encode it as a JSON attachment
    // (PDF generation is handled by the document studio; we attach the raw content
    //  as a fallback until PDF export is wired here)
    const docJson = JSON.stringify(doc.content, null, 2);
    attachments.push({
      filename: `${resumeTitle.replace(/[^a-z0-9 _-]/gi, "_")}.json`,
      content: Buffer.from(docJson, "utf8"),
      contentType: "application/json",
    });
  }

  const subject =
    fu.subject ??
    `Following up on ${fu.applicationTitle} at ${fu.applicationCompany}`;

  const result = await sendEmail(user, connection.id, {
    to: parsed.data.recipientEmail,
    subject,
    body: fu.message,
    attachments,
  });

  if (!result.ok) {
    return Response.json({ error: result.error ?? "Failed to send email." }, { status: 502 });
  }

  // Mark sent + save recipient email
  await db.query(
    `UPDATE application_follow_ups
     SET status='sent', sent_at=COALESCE(sent_at,now()),
         recipient_email=$3, delivery_method='email', updated_at=now()
     WHERE id=$1 AND user_id=$2`,
    [id.data, user, parsed.data.recipientEmail],
  );

  // Log to application timeline
  await db.query(
    `INSERT INTO application_events(user_id, application_id, event_type, title, body, metadata)
     VALUES($1,$2,'follow_up',$3,$4,$5::jsonb)`,
    [
      user,
      fu.applicationId,
      `Follow-up email sent`,
      `Sent "${subject}" to ${parsed.data.recipientEmail}`,
      JSON.stringify({ followUpId: id.data, recipientEmail: parsed.data.recipientEmail }),
    ],
  );

  return Response.json({ sent: true });
}
