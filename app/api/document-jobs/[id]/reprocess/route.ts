import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

const idSchema = z.string().uuid();

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return Response.json({ error: "Invalid document job." }, { status: 400 });

  const created = await db.query(
    `INSERT INTO document_generation_jobs(user_id,kind,target_job,career_context)
     SELECT user_id,kind,target_job,career_context
     FROM document_generation_jobs
     WHERE id=$1 AND user_id=$2
     RETURNING id,kind,target_job AS "targetJob",status,result,error,created_at AS "createdAt",archived_at AS "archivedAt"`,
    [id.data, user],
  );
  if (!created.rowCount) return Response.json({ error: "Draft not found." }, { status: 404 });
  return Response.json({ job: created.rows[0] }, { status: 202 });
}
