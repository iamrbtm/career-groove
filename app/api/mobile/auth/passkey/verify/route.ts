import { z } from "zod";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { createMobileSession, hashAuthIdentifier } from "@/lib/mobile-auth";

const inputSchema = z.object({
  requestId: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
  id: z.string().regex(/^[A-Za-z0-9_-]+$/).max(2048),
  rawId: z.string().regex(/^[A-Za-z0-9_-]+$/).max(2048),
  type: z.literal("public-key"),
  response: z.object({
    authenticatorData: z.string().regex(/^[A-Za-z0-9_-]+$/).max(10000),
    clientDataJSON: z.string().regex(/^[A-Za-z0-9_-]+$/).max(10000),
    signature: z.string().regex(/^[A-Za-z0-9_-]+$/).max(10000),
    userHandle: z.string().regex(/^[A-Za-z0-9_-]*$/).max(2048).nullable(),
  }),
  deviceName: z.string().trim().max(120).optional(),
});

export async function POST(request: Request) {
  if (process.env.AUTH_EXPERIMENTAL_ENABLE_PASSKEYS !== "true") {
    return Response.json({ error: "Passkeys are not enabled." }, { status: 503 });
  }
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid passkey assertion." }, { status: 400 });
  const input = parsed.data;
  const challenge = await db.query<{ challenge_hash: string }>(
    `UPDATE mobile_passkey_challenges SET used_at=now()
     WHERE request_id_hash=$1 AND used_at IS NULL AND expires_at > now()
     RETURNING challenge_hash`,
    [hashAuthIdentifier(input.requestId)],
  );
  if (!challenge.rowCount) return Response.json({ error: "Passkey challenge expired." }, { status: 401 });

  const credentialID = Buffer.from(input.rawId, "base64url").toString("base64");
  const authenticator = await db.query(
    `SELECT a.*,u.id AS user_id,u.name,u.email,u.image
     FROM authenticators a JOIN users u ON u.id=a."userId"
     WHERE a."credentialID"=$1`,
    [credentialID],
  );
  const record = authenticator.rows[0];
  if (!record) return Response.json({ error: "Passkey not recognized." }, { status: 401 });

  try {
    const verification = await verifyAuthenticationResponse({
      response: {
        id: input.id,
        rawId: input.rawId,
        type: "public-key",
        clientExtensionResults: {},
        authenticatorAttachment: "platform",
        response: {
          ...input.response,
          userHandle: input.response.userHandle ?? undefined,
        },
      },
      expectedChallenge: (value) => hashAuthIdentifier(value) === challenge.rows[0].challenge_hash,
      expectedOrigin: "https://careergroove.website",
      expectedRPID: "careergroove.website",
      requireUserVerification: true,
      authenticator: {
        credentialID: new Uint8Array(Buffer.from(record.credentialID, "base64")),
        credentialPublicKey: new Uint8Array(Buffer.from(record.credentialPublicKey, "base64")),
        counter: record.counter,
        transports: record.transports?.split(","),
      },
    });
    if (!verification.verified) throw new Error("Passkey verification failed.");
    const updated = await db.query(
      `UPDATE authenticators SET counter=$2
       WHERE "credentialID"=$1 AND counter=$3 RETURNING "credentialID"`,
      [record.credentialID, verification.authenticationInfo.newCounter, record.counter],
    );
    if (!updated.rowCount) throw new Error("Passkey counter changed during verification.");
    const tokens = await createMobileSession(record.user_id, {
      deviceName: input.deviceName,
      platform: "ios",
    });
    return Response.json({
      ...tokens,
      user: { id: record.user_id, name: record.name, email: record.email, image: record.image },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Mobile passkey verification failed", error);
    return Response.json({ error: "Passkey verification failed." }, { status: 401 });
  }
}
