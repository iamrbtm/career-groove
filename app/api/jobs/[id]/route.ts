import { auth } from "@/auth";
import { db } from "@/lib/db";
import { jobUpdate } from "@/lib/job-schema";
import { z } from "zod";

const idSchema = z.string().uuid();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = idSchema.safeParse((await params).id);
  const input = jobUpdate.safeParse(await request.json());
  if (!id.success || !input.success) return Response.json({ error: "Invalid job update" }, { status: 400 });
  const { inferredSkills, ...jobFields } = input.data;
  const fields = Object.entries(jobFields);
  if (!fields.length) return Response.json({ error: "No changes supplied" }, { status: 400 });
  const columns: Record<string, string> = { company: "company", title: "title", location: "location", startedOn: "started_on", endedOn: "ended_on", current: "current", rawNotes: "raw_notes", achievements: "achievements", metadata: "metadata" };
  const values = fields.map(([, value]) => Array.isArray(value) || (value && typeof value === "object") ? JSON.stringify(value) : value || null);
  const setters = fields.map(([key], index) => `${columns[key]} = $${index + 3}${key === "achievements" || key === "metadata" ? "::jsonb" : ""}`);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE jobs SET ${setters.join(", ")}, updated_at = now() WHERE id = $1 AND user_id = $2
       RETURNING id, company, title, location, started_on AS "startedOn", ended_on AS "endedOn", current, raw_notes AS "rawNotes", achievements, metadata`,
      [id.data, session.user.id, ...values],
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
          [session.user.id, skillInput.name, skillInput.category],
        );
        await client.query("INSERT INTO job_skills(job_id,skill_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [id.data, skill.rows[0].id]);
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
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return Response.json({ error: "Invalid job id" }, { status: 400 });
  const result = await db.query("DELETE FROM jobs WHERE id = $1 AND user_id = $2", [id.data, session.user.id]);
  if (!result.rowCount) return Response.json({ error: "Job not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
