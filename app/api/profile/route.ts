import { requireUser, unauthorized } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { z } from "zod";

const profileInput = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(40).default(""),
});

export async function GET() {
  const userId = await requireUser();
  if (!userId) return unauthorized();
  const result = await db.query(`SELECT id,name,email,image,COALESCE(preferences->>'phone','') AS phone,created_at AS "createdAt" FROM users WHERE id=$1`, [userId]);
  return Response.json({ profile: result.rows[0] });
}

export async function PATCH(request: Request) {
  const userId = await requireUser();
  if (!userId) return unauthorized();
  const parsed = profileInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a valid name and a phone number no longer than 40 characters." }, { status: 400 });
  const result = await db.query(
    `UPDATE users SET name=$2,
       preferences=CASE WHEN $3='' THEN preferences-'phone' ELSE jsonb_set(preferences,'{phone}',to_jsonb($3::text),true) END,
       updated_at=now() WHERE id=$1
     RETURNING id,name,email,image,COALESCE(preferences->>'phone','') AS phone,created_at AS "createdAt"`,
    [userId, parsed.data.name, parsed.data.phone],
  );
  return Response.json({ profile: result.rows[0] });
}
