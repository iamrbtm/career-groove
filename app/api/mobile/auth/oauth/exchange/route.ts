import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { createMobileSession, hashAuthIdentifier } from "@/lib/mobile-auth";

const inputSchema = z.object({
  code: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
  state: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
  codeVerifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
  deviceName: z.string().trim().max(120).optional(),
});

function challenge(verifier: string) {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid authorization code" }, { status: 401 });
  const input = parsed.data;
  const result = await db.query<{ user_id: string }>(
    `UPDATE mobile_oauth_codes SET used_at=now()
     WHERE code_hash=$1 AND state_hash=$2 AND code_challenge=$3
       AND used_at IS NULL AND expires_at > now()
     RETURNING user_id`,
    [hashAuthIdentifier(input.code), hashAuthIdentifier(input.state), challenge(input.codeVerifier)],
  );
  const userId = result.rows[0]?.user_id;
  if (!userId) return Response.json({ error: "Invalid authorization code" }, { status: 401 });

  const tokens = await createMobileSession(userId, { deviceName: input.deviceName, platform: "ios" });
  const profile = await db.query(
    "SELECT id,name,email,image FROM users WHERE id=$1",
    [userId],
  );
  return Response.json(
    { ...tokens, user: profile.rows[0] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
