import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

const idSchema = z.string().uuid();
const input = z.object({ archived: z.literal(true) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return Response.json({ error: "Invalid document job." }, { status: 400 });
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const archived = await db.query(
    `UPDATE document_generation_jobs SET archived_at=now(),updated_at=now()
     WHERE id=$1 AND user_id=$2 AND archived_at IS NULL
     RETURNING id`,
    [id.data, user],
  );
  if (!archived.rowCount) return Response.json({ error: "Draft not found." }, { status: 404 });

  await db.query(
    `UPDATE application_documents SET status='archived',updated_at=now()
     WHERE document_generation_job_id=$1 AND user_id=$2 AND status<>'archived'`,
    [id.data, user],
  );

  return Response.json({ ok: true });
}
