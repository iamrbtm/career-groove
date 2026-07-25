import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

const credentialsSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(256),
});

export async function verifyCredentials(raw: unknown) {
  const input = credentialsSchema.safeParse(raw);
  if (!input.success) return null;

  const result = await db.query(
    "SELECT id, name, email, image, password_hash FROM users WHERE lower(email) = $1",
    [input.data.email],
  );
  const user = result.rows[0];
  if (!user?.password_hash || !(await compare(input.data.password, user.password_hash))) return null;

  return { id: String(user.id), name: user.name, email: user.email, image: user.image };
}

export function normalizeEmail(value: unknown) {
  const parsed = z.string().trim().email().safeParse(value);
  return parsed.success ? parsed.data.toLowerCase() : null;
}
