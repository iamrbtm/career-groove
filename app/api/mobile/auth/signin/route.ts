import { z } from "zod";
import { db } from "@/lib/db";
import { verifyCredentials, normalizeEmail } from "@/lib/credentials-auth";
import { createMobileSession, hashAuthIdentifier } from "@/lib/mobile-auth";

const inputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(256),
  deviceName: z.string().trim().max(120).optional(),
});

function clientAddress(request: Request) {
  return request.headers.get("x-real-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
}

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid credentials" }, { status: 401 });

  const email = normalizeEmail(parsed.data.email);
  if (!email) return Response.json({ error: "Invalid credentials" }, { status: 401 });
  const identifierHash = hashAuthIdentifier(email);
  const networkHash = hashAuthIdentifier(clientAddress(request));

  await db.query("DELETE FROM mobile_auth_attempts WHERE attempted_at < now() - interval '1 day'");
  const attempts = await db.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM mobile_auth_attempts
     WHERE identifier_hash=$1 AND network_hash=$2 AND attempted_at > now() - interval '15 minutes'`,
    [identifierHash, networkHash],
  );
  if ((attempts.rows[0]?.count ?? 0) >= 5) {
    return Response.json(
      { error: "Too many sign-in attempts. Try again later." },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }

  const user = await verifyCredentials(parsed.data);
  if (!user) {
    await db.query(
      "INSERT INTO mobile_auth_attempts(identifier_hash,network_hash) VALUES($1,$2)",
      [identifierHash, networkHash],
    );
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  await db.query("DELETE FROM mobile_auth_attempts WHERE identifier_hash=$1", [identifierHash]);
  const tokens = await createMobileSession(user.id, {
    deviceName: parsed.data.deviceName,
    platform: "ios",
  });
  return Response.json({
    ...tokens,
    user: { id: user.id, name: user.name, email: user.email, image: user.image },
  }, { headers: { "Cache-Control": "no-store" } });
}
