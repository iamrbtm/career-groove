import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/api-auth";
import { hashAuthIdentifier } from "@/lib/mobile-auth";

const querySchema = z.object({
  state: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
});

export async function GET(request: Request) {
  const userId = await requireUser();
  if (!userId) return Response.json({ error: "Authorization session was not established." }, { status: 401 });
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: "Invalid authorization callback" }, { status: 400 });

  await db.query("DELETE FROM mobile_oauth_codes WHERE expires_at < now() OR used_at IS NOT NULL");
  const code = randomBytes(32).toString("base64url");
  await db.query(
    `INSERT INTO mobile_oauth_codes(code_hash,user_id,code_challenge,state_hash,expires_at)
     VALUES($1,$2,$3,$4,now() + interval '2 minutes')`,
    [hashAuthIdentifier(code), userId, parsed.data.code_challenge, hashAuthIdentifier(parsed.data.state)],
  );
  const callback = new URL("careergroove://auth/callback");
  callback.searchParams.set("code", code);
  callback.searchParams.set("state", parsed.data.state);
  return Response.redirect(callback, 302);
}
