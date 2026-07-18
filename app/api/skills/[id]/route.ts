import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";
import { z } from "zod";

const paramsSchema = z.string().uuid();
const updateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  proficiency: z.number().int().min(1).max(5),
  category: z.enum(["interpersonal_behavioral", "cognitive_methodological", "technical_digital", "business_operational", "specialized_vocational", "other"]),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const id = paramsSchema.safeParse((await params).id);
  const body = updateSchema.safeParse(await request.json());
  if (!id.success || !body.success) return Response.json({ error: "Invalid skill details." }, { status: 400 });
  try {
    const result = await db.query(
      `UPDATE skills SET name=$1,proficiency=$2,category=$3,updated_at=now() WHERE id=$4 AND user_id=$5
       RETURNING id,name,proficiency,category`,
      [body.data.name, body.data.proficiency, body.data.category, id.data, user],
    );
    return result.rowCount ? Response.json({ skill: result.rows[0] }) : Response.json({ error: "Not found" }, { status: 404 });
  } catch (error: any) {
    if (error?.code === "23505") return Response.json({ error: "You already have a skill with that name." }, { status: 409 });
    throw error;
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const id = paramsSchema.safeParse((await params).id);
  if (!id.success) return Response.json({ error: "Invalid skill id." }, { status: 400 });
  const result = await db.query("DELETE FROM skills WHERE id=$1 AND user_id=$2", [id.data, user]);
  return result.rowCount ? new Response(null, { status: 204 }) : Response.json({ error: "Not found" }, { status: 404 });
}
