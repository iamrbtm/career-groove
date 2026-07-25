import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import { db } from "@/lib/db";
import { createMobileSession } from "@/lib/mobile-auth";

const appleKeys = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
const inputSchema = z.object({
  identityToken: z.string().min(100).max(10000),
  nonce: z.string().min(32).max(256),
  givenName: z.string().trim().max(100).optional(),
  familyName: z.string().trim().max(100).optional(),
  deviceName: z.string().trim().max(120).optional(),
});

const nonceDigest = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

export async function POST(request: Request) {
  const clientId = process.env.AUTH_APPLE_IOS_CLIENT_ID;
  if (!clientId) return Response.json({ error: "Sign in with Apple is not configured." }, { status: 503 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid Apple authorization" }, { status: 401 });

  try {
    const { payload } = await jwtVerify(parsed.data.identityToken, appleKeys, {
      issuer: "https://appleid.apple.com",
      audience: clientId,
    });
    if (!payload.sub || !payload.jti || payload.nonce !== nonceDigest(parsed.data.nonce)) {
      return Response.json({ error: "Invalid Apple authorization" }, { status: 401 });
    }
    const emailVerified = payload.email_verified === true || payload.email_verified === "true";
    const email = typeof payload.email === "string" && emailVerified ? payload.email.toLowerCase() : null;
    const expiresAt = new Date((payload.exp ?? 0) * 1000);
    if (expiresAt <= new Date()) return Response.json({ error: "Apple authorization expired" }, { status: 401 });

    const client = await db.connect();
    let user;
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM mobile_identity_assertions WHERE expires_at < now()");
      await client.query(
        "INSERT INTO mobile_identity_assertions(assertion_id,expires_at) VALUES($1,$2)",
        [payload.jti, expiresAt],
      );
      const account = await client.query(
        `SELECT u.id,u.name,u.email,u.image FROM accounts a
         JOIN users u ON u.id=a."userId"
         WHERE a.provider='apple' AND a."providerAccountId"=$1`,
        [payload.sub],
      );
      user = account.rows[0];
      if (!user) {
        if (!email) throw new Error("Apple did not provide a verified email address.");
        const name = [parsed.data.givenName, parsed.data.familyName].filter(Boolean).join(" ") || null;
        const userResult = await client.query(
          `INSERT INTO users(name,email) VALUES($1,$2)
           ON CONFLICT(email) DO UPDATE SET updated_at=now()
           RETURNING id,name,email,image`,
          [name, email],
        );
        user = userResult.rows[0];
        await client.query(
          `INSERT INTO accounts("userId",type,provider,"providerAccountId")
           VALUES($1,'oidc','apple',$2)
           ON CONFLICT(provider,"providerAccountId") DO NOTHING`,
          [user.id, payload.sub],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const tokens = await createMobileSession(user.id, {
      deviceName: parsed.data.deviceName,
      platform: "ios",
    });
    return Response.json(
      { ...tokens, user },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Apple mobile sign-in failed", error);
    return Response.json({ error: "Apple authorization could not be verified." }, { status: 401 });
  }
}
