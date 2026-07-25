import { randomBytes } from "node:crypto";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { hashAuthIdentifier } from "@/lib/mobile-auth";

const rpID = "careergroove.website";

export async function POST() {
  if (process.env.AUTH_EXPERIMENTAL_ENABLE_PASSKEYS !== "true") {
    return Response.json({ error: "Passkeys are not enabled." }, { status: 503 });
  }
  await db.query("DELETE FROM mobile_passkey_challenges WHERE expires_at < now() OR used_at IS NOT NULL");
  const requestId = randomBytes(32).toString("base64url");
  const options = await generateAuthenticationOptions({
    rpID,
    timeout: 300000,
    userVerification: "required",
  });
  await db.query(
    `INSERT INTO mobile_passkey_challenges(request_id_hash,challenge_hash,expires_at)
     VALUES($1,$2,now() + interval '5 minutes')`,
    [hashAuthIdentifier(requestId), hashAuthIdentifier(options.challenge)],
  );
  return Response.json({
    requestId,
    challenge: options.challenge,
    relyingPartyIdentifier: rpID,
    timeout: options.timeout,
  }, { headers: { "Cache-Control": "no-store" } });
}
