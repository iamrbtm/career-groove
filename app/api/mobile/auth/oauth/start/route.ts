import { z } from "zod";

const querySchema = z.object({
  provider: z.enum(["apple", "google", "github", "passkey"]),
  state: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
});

function available(provider: z.infer<typeof querySchema>["provider"]) {
  if (provider === "passkey") return process.env.AUTH_EXPERIMENTAL_ENABLE_PASSKEYS === "true";
  const prefix = provider.toUpperCase();
  return Boolean(process.env[`AUTH_${prefix}_ID`] && process.env[`AUTH_${prefix}_SECRET`]);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return Response.json({ error: "Invalid authorization request" }, { status: 400 });
  if (!available(parsed.data.provider)) {
    return Response.json({ error: "This sign-in provider is not configured." }, { status: 503 });
  }

  const complete = new URL("/api/mobile/auth/oauth/complete", url.origin);
  complete.searchParams.set("state", parsed.data.state);
  complete.searchParams.set("code_challenge", parsed.data.code_challenge);
  const signIn = new URL(`/api/auth/signin/${parsed.data.provider}`, url.origin);
  signIn.searchParams.set("callbackUrl", complete.toString());
  return Response.redirect(signIn, 302);
}
