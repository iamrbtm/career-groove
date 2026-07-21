import { requireUser, unauthorized } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { z } from "zod";

const profileInput = z.object({ name: z.string().trim().min(2).max(100) });

export async function GET() {
  const userId = await requireUser();
  if (!userId) return unauthorized();
  const result = await db.query(`SELECT id, name, email, image, created_at AS "createdAt" FROM users WHERE id = $1`, [userId]);
  return Response.json({ profile: result.rows[0] });
}

export async function PATCH(request: Request) {
  const userId = await requireUser();
  if (!userId) return unauthorized();
  const parsed = profileInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a name between 2 and 100 characters." }, { status: 400 });
  const result = await db.query(
    `UPDATE users SET name = $2, updated_at = now() WHERE id = $1 RETURNING id, name, email, image, created_at AS "createdAt"`,
    [userId, parsed.data.name],
  );
  return Response.json({ profile: result.rows[0] });
}
