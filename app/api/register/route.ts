import { hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

const registration = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(10).max(128).regex(/[a-zA-Z]/, "Include a letter").regex(/\d/, "Include a number"),
});

export async function POST(request: Request) {
  const parsed = registration.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const { name, email, password } = parsed.data;
  const passwordHash = await hash(password, 12);
  try {
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at AS "createdAt"`,
      [name, email, passwordHash],
    );
    return Response.json({ user: result.rows[0] }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") return Response.json({ error: "An account already exists for this email." }, { status: 409 });
    return Response.json({ error: "Account creation failed." }, { status: 500 });
  }
}
