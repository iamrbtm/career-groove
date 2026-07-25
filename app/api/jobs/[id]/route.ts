import { requireUser, unauthorized } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { jobUpdate } from "@/lib/job-schema";
import { z } from "zod";

const idSchema = z.string().uuid();

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUser();
  if (!userId) return unauthorized();
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return Response.json({ error: "Invalid job id" }, { status: 400 });
  const result = await db.query(
    `SELECT j.id,j.company,j.title,j.location,j.started_on AS "startedOn",j.ended_on AS "endedOn",
      COALESCE(j.current, false) AS "current",j.raw_notes AS "rawNotes",j.achievements,j.metadata,
      CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('name',c.name,'phone',c.phone) END AS "networkContact"
     FROM jobs j LEFT JOIN LATERAL (
       SELECT id,name,phone FROM contacts WHERE user_id=j.user_id AND job_id=j.id ORDER BY created_at LIMIT 1
     ) c ON true
     WHERE j.id=$1 AND j.user_id=$2`,
    [id.data, userId],
  );
  return result.rowCount
    ? Response.json({ job: result.rows[0] })
    : Response.json({ error: "Job not found" }, { status: 404 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUser();
  if (!userId) return unauthorized();
  const id = idSchema.safeParse((await params).id);
  const input = jobUpdate.safeParse(await request.json());
  if (!id.success || !input.success) return Response.json({ error: "Invalid job update" }, { status: 400 });
  const { inferredSkills, networkContact, ...jobFields } = input.data;
  const fields = Object.entries(jobFields);
  if (!fields.length) return Response.json({ error: "No changes supplied" }, { status: 400 });
  const columns: Record<string, string> = { company: "company", title: "title", location: "location", startedOn: "started_on", endedOn: "ended_on", current: "current", rawNotes: "raw_notes", achievements: "achievements", metadata: "metadata" };
  const values = fields.map(([, value]) => Array.isArray(value) || (value && typeof value === "object") ? JSON.stringify(value) : value ?? null);
  const setters = fields.map(([key], index) => `${columns[key]} = $${index + 3}${key === "achievements" || key === "metadata" ? "::jsonb" : ""}`);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE jobs SET ${setters.join(", ")}, updated_at = now() WHERE id = $1 AND user_id = $2
        RETURNING id, company, title, location, started_on AS "startedOn", ended_on AS "endedOn", COALESCE(current, false) AS "current", raw_notes AS "rawNotes", achievements, metadata`,
      [id.data, userId, ...values],
    );
    if (!result.rowCount) { await client.query("ROLLBACK"); return Response.json({ error: "Job not found" }, { status: 404 }); }
    if (inferredSkills) {
      await client.query("DELETE FROM job_skills WHERE job_id=$1", [id.data]);
      const uniqueSkills = [...new Map(inferredSkills.map((skill) => [skill.name.trim().toLocaleLowerCase(), skill])).values()];
      for (const skillInput of uniqueSkills) {
        const skill = await client.query(
          `INSERT INTO skills(user_id,name,proficiency,category) VALUES($1,$2,3,$3)
           ON CONFLICT (user_id,lower(name)) DO UPDATE SET updated_at=now()
           RETURNING id`,
          [userId, skillInput.name, skillInput.category],
        );
        await client.query("INSERT INTO job_skills(job_id,skill_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [id.data, skill.rows[0].id]);
      }
    }
    if (networkContact) {
      const contactName = networkContact.name.trim();
      if (contactName && !/^(none|no|n\/a|not applicable)$/i.test(contactName)) {
        const existing = await client.query(
          `UPDATE contacts SET name=$3,company=$4,role=$5,phone=NULLIF($6,'')
           WHERE user_id=$1 AND job_id=$2 RETURNING id`,
          [userId,id.data,contactName,result.rows[0].company,result.rows[0].title,networkContact.phone],
        );
        if (!existing.rowCount) {
          await client.query(
            `INSERT INTO contacts(user_id,job_id,name,company,role,phone,relationship_strength,notes)
             VALUES($1,$2,$3,$4,$5,NULLIF($6,''),3,$7::jsonb)
             ON CONFLICT (user_id,job_id,lower(name)) WHERE job_id IS NOT NULL
             DO UPDATE SET phone=EXCLUDED.phone,company=EXCLUDED.company,role=EXCLUDED.role`,
            [userId,id.data,contactName,result.rows[0].company,result.rows[0].title,networkContact.phone,JSON.stringify([{text:`Contact for ${result.rows[0].title} at ${result.rows[0].company}`,at:new Date().toISOString()}])],
          );
        }
      }
    }
    await client.query("COMMIT");
    return Response.json({ job: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Job update failed", error);
    return Response.json({ error: "The chapter could not be updated." }, { status: 500 });
  } finally { client.release(); }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUser();
  if (!userId) return unauthorized();
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return Response.json({ error: "Invalid job id" }, { status: 400 });
  const result = await db.query("DELETE FROM jobs WHERE id = $1 AND user_id = $2", [id.data, userId]);
  if (!result.rowCount) return Response.json({ error: "Job not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
