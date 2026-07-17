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
  const fields = Object.entries(input.data);
  if (!fields.length) return Response.json({ error: "No changes supplied" }, { status: 400 });
  const columns: Record<string, string> = { company: "company", title: "title", location: "location", startedOn: "started_on", endedOn: "ended_on", current: "current", rawNotes: "raw_notes", achievements: "achievements", metadata: "metadata" };
  const values = fields.map(([, value]) => Array.isArray(value) || (value && typeof value === "object") ? JSON.stringify(value) : value || null);
  const setters = fields.map(([key], index) => `${columns[key]} = $${index + 3}${key === "achievements" || key === "metadata" ? "::jsonb" : ""}`);
  const result = await db.query(
    `UPDATE jobs SET ${setters.join(", ")}, updated_at = now() WHERE id = $1 AND user_id = $2
     RETURNING id, company, title, location, started_on AS "startedOn", ended_on AS "endedOn", current, raw_notes AS "rawNotes", achievements, metadata`,
    [id.data, session.user.id, ...values],
  );
  if (!result.rowCount) return Response.json({ error: "Job not found" }, { status: 404 });
  return Response.json({ job: result.rows[0] });
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
