import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";
import { refreshApplicationScore } from "@/lib/tracker-studio";

const idSchema = z.string().uuid();

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return Response.json({ error: "Invalid application id" }, { status: 400 });

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const score = await refreshApplicationScore(client, user, id.data);
    if (!score) {
      await client.query("ROLLBACK");
      return Response.json({ error: "Application not found" }, { status: 404 });
    }
    await client.query("COMMIT");
    return Response.json(score);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Application scoring failed", error);
    return Response.json({ error: "The role could not be rescored." }, { status: 500 });
  } finally {
    client.release();
  }
}
