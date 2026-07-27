import { requireUser, unauthorized } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { z } from "zod";

const socialFields = ["linkedin", "github", "portfolio", "twitter", "website"] as const;

const profileInput = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(40).default(""),
  linkedin: z.string().trim().max(200).optional(),
  github: z.string().trim().max(200).optional(),
  portfolio: z.string().trim().max(200).optional(),
  twitter: z.string().trim().max(200).optional(),
  website: z.string().trim().max(200).optional(),
});

const profileSelect = `
  SELECT id, name, email, image,
    COALESCE(preferences->>'phone','') AS phone,
    COALESCE(preferences->>'linkedin','') AS linkedin,
    COALESCE(preferences->>'github','') AS github,
    COALESCE(preferences->>'portfolio','') AS portfolio,
    COALESCE(preferences->>'twitter','') AS twitter,
    COALESCE(preferences->>'website','') AS website,
    created_at AS "createdAt"
  FROM users WHERE id=$1
`;

export async function GET() {
  const userId = await requireUser();
  if (!userId) return unauthorized();
  const result = await db.query(profileSelect, [userId]);
  return Response.json({ profile: result.rows[0] });
}

export async function PATCH(request: Request) {
  const userId = await requireUser();
  if (!userId) return unauthorized();
  const parsed = profileInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a valid name and a phone number no longer than 40 characters." }, { status: 400 });

  const input = parsed.data;
  const sets = ["name=$2"];
  const values: unknown[] = [userId, input.name];
  let idx = 3;

  for (const field of socialFields) {
    const value = input[field as keyof typeof input];
    if (value !== undefined) {
      const path = `{${field}}`;
      if (value === "") {
        sets.push(`preferences = preferences - '${field}'::text`);
      } else {
        sets.push(`preferences = jsonb_set(preferences, $${idx}::text[], to_jsonb($${idx + 1}::text), true)`);
        values.push(path, value);
        idx += 2;
      }
    }
  }

  const result = await db.query(
    `UPDATE users SET ${sets.join(", ")}, updated_at=now() WHERE id=$1 RETURNING id`,
    values,
  );

  const profile = await db.query(profileSelect, [userId]);
  return Response.json({ profile: profile.rows[0] });
}
