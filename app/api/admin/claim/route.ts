import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

export async function POST() {
  const user = await requireUser();
  if (!user) return unauthorized();
  const existing = await db.query("SELECT 1 FROM admins");
  if ((existing.rowCount ?? 0) > 0) return Response.json({ error: "Admin already claimed." }, { status: 403 });
  await db.query("INSERT INTO admins (user_id) VALUES ($1)", [user]);
  return Response.json({ ok: true });
}
