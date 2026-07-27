import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";
import { AI_TASK_IDS } from "@/lib/ai-tasks";

const taskSchema = z.string().refine((value) => (AI_TASK_IDS as readonly string[]).includes(value), { message: "Unknown task" });

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set"), task: taskSchema, provider: z.string().min(1).max(50), model: z.string().min(1).max(200) }),
  z.object({ action: z.literal("remove"), task: taskSchema }),
]);

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();
  const result = await db.query(`SELECT task, provider, model FROM task_model_mappings WHERE user_id=$1 ORDER BY task`, [user]);
  return Response.json({ mappings: result.rows });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const input = parsed.data;
  if (input.action === "set") {
    const active = await db.query(
      `SELECT 1 FROM provider_connections WHERE user_id=$1 AND provider=$2 AND active=true AND available_models @> $3::jsonb`,
      [user, input.provider, JSON.stringify([{ id: input.model }])],
    );
    if (!active.rowCount) return Response.json({ error: "Choose an active provider with that model available." }, { status: 400 });
    await db.query(
      `INSERT INTO task_model_mappings(user_id, task, provider, model) VALUES($1,$2,$3,$4)
       ON CONFLICT(user_id, task) DO UPDATE SET provider=EXCLUDED.provider, model=EXCLUDED.model, updated_at=now()`,
      [user, input.task, input.provider, input.model],
    );
    return Response.json({ task: input.task, provider: input.provider, model: input.model });
  }
  await db.query(`DELETE FROM task_model_mappings WHERE user_id=$1 AND task=$2`, [user, input.task]);
  return new Response(null, { status: 204 });
}
