import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({
  appliedAt: z.string().datetime().or(z.literal("")).optional(),
  confirmationNumber: z.string().trim().max(200).optional(),
  applicationUrl: z.string().trim().url().max(2000).or(z.literal("")).optional(),
  resumeDocumentId: z.string().uuid().optional().nullable(),
  coverLetterDocumentId: z.string().uuid().optional().nullable(),
  contactUsed: z.boolean().default(false),
  followUpDueAt: z.string().datetime().or(z.literal("")).optional(),
  notes: z.string().trim().max(5000).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsedParams = paramsSchema.safeParse(await params);
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedParams.success || !parsedBody.success) return Response.json({ error: "Invalid submission details" }, { status: 400 });
  const input = parsedBody.data;
  const appliedAt = input.appliedAt || new Date().toISOString();

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const app = await client.query(
      `UPDATE applications
       SET status='applied',applied_at=COALESCE($3::timestamptz,now()),
        follow_up_due_at=COALESCE($4::timestamptz,follow_up_due_at,now() + (COALESCE((SELECT default_follow_up_days FROM user_job_preferences WHERE user_id=$2),7)::int || ' days')::interval),
        metadata=jsonb_set(metadata, '{submission}', $5::jsonb, true),updated_at=now()
       WHERE id=$1 AND user_id=$2
       RETURNING id,status,applied_at AS "appliedAt",follow_up_due_at AS "followUpDueAt",metadata`,
      [
        parsedParams.data.id,
        user,
        appliedAt,
        input.followUpDueAt || null,
        JSON.stringify({
          confirmationNumber: input.confirmationNumber || null,
          applicationUrl: input.applicationUrl || null,
          resumeDocumentId: input.resumeDocumentId || null,
          coverLetterDocumentId: input.coverLetterDocumentId || null,
          contactUsed: input.contactUsed,
          notes: input.notes || null,
          submittedAt: appliedAt,
        }),
      ],
    );
    if (!app.rowCount) {
      await client.query("ROLLBACK");
      return Response.json({ error: "Application not found" }, { status: 404 });
    }
    for (const documentId of [input.resumeDocumentId, input.coverLetterDocumentId].filter(Boolean)) {
      await client.query(
        `UPDATE application_documents
         SET status='submitted',submitted_at=COALESCE(submitted_at,$3::timestamptz),updated_at=now()
         WHERE id=$1 AND user_id=$2`,
        [documentId, user, appliedAt],
      );
    }
    await client.query(
      `INSERT INTO application_events(user_id,application_id,event_type,title,body,metadata)
       VALUES($1,$2,'status_changed','Application submitted',$3,$4::jsonb)`,
      [
        user,
        parsedParams.data.id,
        input.notes || input.confirmationNumber || null,
        JSON.stringify({ status: "applied", resumeDocumentId: input.resumeDocumentId || null, coverLetterDocumentId: input.coverLetterDocumentId || null }),
      ],
    );
    await client.query("COMMIT");
    return Response.json({ application: app.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Submission recording failed", error);
    return Response.json({ error: "Submission could not be recorded." }, { status: 500 });
  } finally {
    client.release();
  }
}
