import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

const paramsSchema = z.object({ id: z.string().uuid() });
const inputSchema = z.object({
  documentGenerationJobId: z.string().uuid().optional(),
  kind: z.enum(["resume", "cover_letter", "other"]),
  title: z.string().trim().max(200).optional(),
  status: z.enum(["draft", "generated", "submitted", "archived"]).default("draft"),
  submittedAt: z.string().datetime().or(z.literal("")).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsedParams = paramsSchema.safeParse(await params);
  const parsedBody = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsedParams.success || !parsedBody.success) {
    return Response.json({ error: "Invalid document link" }, { status: 400 });
  }

  const appExists = await db.query("SELECT id FROM applications WHERE id=$1 AND user_id=$2", [parsedParams.data.id, user]);
  if (!appExists.rowCount) return Response.json({ error: "Application not found" }, { status: 404 });

  const input = parsedBody.data;
  const linkedJob = input.documentGenerationJobId
    ? await db.query(
      `SELECT id,target_job,status
       FROM document_generation_jobs
       WHERE id=$1 AND user_id=$2`,
      [input.documentGenerationJobId, user],
    )
    : null;
  if (input.documentGenerationJobId && !linkedJob?.rowCount) {
    return Response.json({ error: "Draft not found" }, { status: 404 });
  }

  const created = await db.query(
    `INSERT INTO application_documents(user_id,application_id,document_generation_job_id,kind,title,status,submitted_at,metadata)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
     RETURNING id,kind,title,status,submitted_at AS "submittedAt",metadata,created_at AS "createdAt"`,
    [
      user,
      parsedParams.data.id,
      input.documentGenerationJobId ?? null,
      input.kind,
      input.title || linkedJob?.rows[0]?.target_job?.title || null,
      input.status,
      input.submittedAt || null,
      JSON.stringify({ fromDocumentJob: input.documentGenerationJobId ?? null }),
    ],
  );
  await db.query(
    `INSERT INTO application_events(user_id,application_id,event_type,title,metadata)
     VALUES($1,$2,'document_linked',$3,$4::jsonb)`,
    [
      user,
      parsedParams.data.id,
      `${input.kind === "cover_letter" ? "Cover letter" : input.kind === "resume" ? "Resume" : "Document"} linked`,
      JSON.stringify({ kind: input.kind, documentGenerationJobId: input.documentGenerationJobId ?? null }),
    ],
  );
  return Response.json({ document: created.rows[0] }, { status: 201 });
}
