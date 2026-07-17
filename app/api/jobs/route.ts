import { auth } from "@/auth";
import { db } from "@/lib/db";
import { jobInput } from "@/lib/job-schema";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const result = await db.query(
    `SELECT id, company, title, location, started_on AS "startedOn", ended_on AS "endedOn",
      current, raw_notes AS "rawNotes", achievements, metadata, created_at AS "createdAt"
     FROM jobs WHERE user_id = $1 ORDER BY current DESC, started_on DESC NULLS LAST, created_at DESC`,
    [session.user.id],
  );
  return Response.json({ jobs: result.rows });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = jobInput.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const job = parsed.data;
  const result = await db.query(
    `INSERT INTO jobs (user_id, company, title, location, started_on, ended_on, current, raw_notes, achievements, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)
     RETURNING id, company, title, location, started_on AS "startedOn", ended_on AS "endedOn",
       current, raw_notes AS "rawNotes", achievements, metadata, created_at AS "createdAt"`,
    [session.user.id, job.company, job.title, job.location || null, job.startedOn || null, job.current ? null : job.endedOn || null,
      job.current, job.rawNotes || null, JSON.stringify(job.achievements), JSON.stringify(job.metadata)],
  );
  return Response.json({ job: result.rows[0] }, { status: 201 });
}
