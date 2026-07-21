import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

const input = z.object({
  kind: z.enum(["resume", "cover_letter", "both"]),
  target: z.object({
    title: z.string().trim().min(1).max(200),
    company: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(50000),
  }),
});

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();
  const jobs = await db.query(
    `SELECT id,kind,target_job AS "targetJob",status,result,error,created_at AS "createdAt",
      started_at AS "startedAt",completed_at AS "completedAt"
     FROM document_generation_jobs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30`,
    [user],
  );
  return Response.json({ jobs: jobs.rows });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const history = await db.query(
    `SELECT company,title,location,started_on AS "startedOn",ended_on AS "endedOn",current,
      raw_notes AS "rawNotes",achievements,metadata FROM jobs WHERE user_id=$1
     ORDER BY current DESC,ended_on DESC NULLS LAST,started_on DESC NULLS LAST`,
    [user],
  );
  const created = await db.query(
    `INSERT INTO document_generation_jobs(user_id,kind,target_job,career_context)
     VALUES($1,$2,$3::jsonb,$4::jsonb)
     RETURNING id,kind,target_job AS "targetJob",status,result,error,created_at AS "createdAt"`,
    [user, parsed.data.kind, JSON.stringify(parsed.data.target), JSON.stringify(history.rows)],
  );
  return Response.json({ job: created.rows[0] }, { status: 202 });
}
