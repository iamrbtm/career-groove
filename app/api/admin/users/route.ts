import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, unauthorized, isAdmin } from "@/lib/api-auth";

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user || !(await isAdmin(user))) return unauthorized();
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const result = await db.query(
    `SELECT id, email, name, image, "subscriptionStatus", created_at,
      (SELECT COUNT(*) FROM applications WHERE user_id = u.id) AS application_count
     FROM users u
     WHERE ($1 = '' OR email ILIKE '%' || $1 || '%' OR name ILIKE '%' || $1 || '%')
     ORDER BY created_at DESC
     LIMIT 100`,
    [search],
  );
  return Response.json({ users: result.rows });
}

const setProSchema = z.object({ userId: z.string().uuid(), pro: z.boolean() });

export async function PATCH(request: Request) {
  const user = await requireUser();
  if (!user || !(await isAdmin(user))) return unauthorized();
  const body = setProSchema.safeParse(await request.json());
  if (!body.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { userId, pro } = body.data;
  if (pro) {
    await db.query(
      `UPDATE users SET "subscriptionStatus" = 'active', updated_at = now() WHERE id = $1`,
      [userId],
    );
  } else {
    await db.query(
      `UPDATE users SET "subscriptionStatus" = 'inactive', updated_at = now() WHERE id = $1`,
      [userId],
    );
  }
  return Response.json({ ok: true });
}
