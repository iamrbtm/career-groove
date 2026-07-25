import { requireUser, unauthorized } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { jobInput } from "@/lib/job-schema";

export async function GET() {
  const userId = await requireUser();
  if (!userId) return unauthorized();
  const result = await db.query(
    `SELECT id, company, title, location, started_on AS "startedOn", ended_on AS "endedOn",
      COALESCE(current, false) AS "current", raw_notes AS "rawNotes", achievements, metadata, created_at AS "createdAt"
     FROM jobs WHERE user_id = $1
     ORDER BY current DESC, ended_on DESC NULLS LAST, started_on DESC NULLS LAST, created_at DESC`,
    [userId],
  );
  return Response.json({ jobs: result.rows });
}

export async function POST(request: Request) {
  const userId = await requireUser();
  if (!userId) return unauthorized();
  const parsed = jobInput.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const job = parsed.data;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
    `INSERT INTO jobs (user_id, company, title, location, started_on, ended_on, current, raw_notes, achievements, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)
     RETURNING id, company, title, location, started_on AS "startedOn", ended_on AS "endedOn",
       COALESCE(current, false) AS "current", raw_notes AS "rawNotes", achievements, metadata, created_at AS "createdAt"`,
    [userId, job.company, job.title, job.location || null, job.startedOn || null, job.current ? null : job.endedOn || null,
      job.current, job.rawNotes || null, JSON.stringify(job.achievements), JSON.stringify(job.metadata)],
    );
    const uniqueSkills = [...new Map(job.inferredSkills.map((skill) => [skill.name.trim().toLocaleLowerCase(), skill])).values()];
    for (const skillInput of uniqueSkills) {
      const skill = await client.query(
        `INSERT INTO skills(user_id,name,proficiency,category) VALUES($1,$2,3,$3)
         ON CONFLICT (user_id,lower(name)) DO UPDATE SET updated_at=now()
         RETURNING id`,
        [userId, skillInput.name, skillInput.category],
      );
      await client.query(
        `INSERT INTO job_skills(job_id,skill_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,
        [result.rows[0].id, skill.rows[0].id],
      );
    }
    const contactName = job.networkContact?.name.trim();
    if (contactName && !/^(none|no|n\/a|not applicable)$/i.test(contactName)) {
      await client.query(
        `INSERT INTO contacts(user_id,job_id,name,company,role,phone,relationship_strength,notes)
         VALUES($1,$2,$3,$4,$5,$6,3,$7::jsonb)
         ON CONFLICT (user_id,job_id,lower(name)) WHERE job_id IS NOT NULL
         DO UPDATE SET phone=COALESCE(NULLIF(EXCLUDED.phone,''),contacts.phone),company=EXCLUDED.company,role=EXCLUDED.role`,
        [userId,result.rows[0].id,contactName,job.company,job.title,job.networkContact?.phone||null,JSON.stringify([{text:`Contact for ${job.title} at ${job.company}`,at:new Date().toISOString()}])],
      );
    }
    await client.query("COMMIT");
    return Response.json({ job: result.rows[0] }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Job creation failed", error);
    return Response.json({ error: "The chapter could not be saved." }, { status: 500 });
  } finally {
    client.release();
  }
}
