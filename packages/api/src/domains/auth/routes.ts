import { compare } from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { Hono } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";

import {
  credentialsLoginSchema,
  tokenRefreshSchema,
} from "@career-groove/shared";

import type { Database } from "../../db.js";
import type { ApiConfig } from "../../config.js";
import type { AppVariables } from "../../http.js";
import { jsonError } from "../../http.js";
import {
  bearerToken,
  hashAuthIdentifier,
  type SessionService,
} from "./session-service.js";

interface AuthRouteDependencies {
  config: ApiConfig;
  database: Database;
  fetch?: typeof fetch;
  sessions: SessionService;
}

interface CredentialUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  password_hash: string | null;
}

const appleKeys = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys"),
);

function clientAddress(headers: Headers): string {
  return (
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export function createAuthRoutes({
  config,
  database,
  fetch: transport = fetch,
  sessions,
}: AuthRouteDependencies) {
  const routes = new Hono<{ Variables: AppVariables }>();

  routes.get("/session", async (context) => {
    const token = bearerToken(context.req.header("Authorization"));
    const userId = token ? await sessions.userIdForAccessToken(token) : null;
    if (!userId) {
      return jsonError(
        context,
        401,
        "unauthorized",
        "Authentication required",
      );
    }
    const result = await database.query(
      "SELECT id,name,email,image FROM users WHERE id=$1",
      [userId],
    );
    if (!result.rows[0]) {
      return jsonError(context, 401, "unauthorized", "Authentication required");
    }
    context.header("Cache-Control", "no-store");
    return context.json({ user: result.rows[0] });
  });

  routes.get("/capabilities", (context) =>
    context.json(
      {
        methods: {
          apple: Boolean(config.appleIosClientId),
          credentials: true,
          github: Boolean(config.githubClientId && config.githubClientSecret),
          google: Boolean(config.googleClientId && config.googleClientSecret),
          // Expo SDK 57 has no production-ready, cross-platform passkey API.
          // Never advertise a flow that this service cannot complete.
          passkey: false,
        },
        tokenPolicy: {
          accessTokenLifetimeSeconds: 900,
          refreshTokenLifetimeSeconds: 2_592_000,
        },
      },
      200,
      { "Cache-Control": "private, max-age=60" },
    ),
  );

  const oauthStart = z.object({
    provider: z.enum(["google", "github"]),
    state: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
    code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
  });
  routes.get("/oauth/start", (context) => {
    const parsed = oauthStart.safeParse(context.req.query());
    if (!parsed.success) {
      return jsonError(
        context,
        400,
        "invalid_oauth_request",
        "Invalid authorization request",
      );
    }
    const input = parsed.data;
    const clientId =
      input.provider === "google"
        ? config.googleClientId
        : config.githubClientId;
    const clientSecret =
      input.provider === "google"
        ? config.googleClientSecret
        : config.githubClientSecret;
    if (!clientId || !clientSecret) {
      return jsonError(
        context,
        503,
        "provider_unavailable",
        "This sign-in provider is not configured",
      );
    }
    const callback = new URL(
      "/api/mobile/auth/oauth/complete",
      config.allowedOrigins[0],
    );
    callback.searchParams.set("provider", input.provider);
    callback.searchParams.set("state", input.state);
    callback.searchParams.set("code_challenge", input.code_challenge);
    const authorization =
      input.provider === "google"
        ? new URL("https://accounts.google.com/o/oauth2/v2/auth")
        : new URL("https://github.com/login/oauth/authorize");
    authorization.searchParams.set("client_id", clientId);
    authorization.searchParams.set("redirect_uri", callback.toString());
    authorization.searchParams.set("state", input.state);
    if (input.provider === "google") {
      authorization.searchParams.set("response_type", "code");
      authorization.searchParams.set("scope", "openid email profile");
    } else {
      authorization.searchParams.set("scope", "read:user user:email");
    }
    return context.redirect(authorization.toString(), 302);
  });

  routes.get("/oauth/complete", async (context) => {
    const parsed = oauthStart.extend({
      code: z.string().min(1).max(2_000),
    }).safeParse(context.req.query());
    if (!parsed.success) {
      return jsonError(context, 400, "invalid_oauth_callback", "Invalid authorization callback");
    }
    const input = parsed.data;
    const clientId =
      input.provider === "google" ? config.googleClientId : config.githubClientId;
    const clientSecret =
      input.provider === "google"
        ? config.googleClientSecret
        : config.githubClientSecret;
    if (!clientId || !clientSecret) {
      return jsonError(context, 503, "provider_unavailable", "Provider is not configured");
    }
    const redirectUri = new URL(
      "/api/mobile/auth/oauth/complete",
      config.allowedOrigins[0],
    );
    redirectUri.searchParams.set("provider", input.provider);
    redirectUri.searchParams.set("state", input.state);
    redirectUri.searchParams.set("code_challenge", input.code_challenge);
    const tokenResponse = await transport(
      input.provider === "google"
        ? "https://oauth2.googleapis.com/token"
        : "https://github.com/login/oauth/access_token",
      {
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: input.code,
          redirect_uri: redirectUri.toString(),
          ...(input.provider === "google" ? { grant_type: "authorization_code" } : {}),
        }),
        headers: { Accept: "application/json" },
        method: "POST",
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!tokenResponse.ok) {
      return jsonError(context, 401, "oauth_failed", "Authorization could not be verified");
    }
    const tokenPayload = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenPayload.access_token) {
      return jsonError(context, 401, "oauth_failed", "Authorization could not be verified");
    }
    const profileResponse = await transport(
      input.provider === "google"
        ? "https://openidconnect.googleapis.com/v1/userinfo"
        : "https://api.github.com/user",
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${tokenPayload.access_token}`,
          "User-Agent": "CareerGroove",
        },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!profileResponse.ok) {
      return jsonError(context, 401, "oauth_failed", "Profile could not be verified");
    }
    const profile = (await profileResponse.json()) as {
      avatar_url?: string;
      email?: string;
      email_verified?: boolean;
      id?: number;
      login?: string;
      name?: string;
      picture?: string;
      sub?: string;
    };
    let email = profile.email?.toLowerCase();
    if (input.provider === "google" && profile.email_verified !== true) email = undefined;
    if (!email || !(input.provider === "google" ? profile.sub : profile.id)) {
      return jsonError(context, 401, "oauth_failed", "A verified email is required");
    }
    const providerAccountId = String(
      input.provider === "google" ? profile.sub : profile.id,
    );
    type OAuthUser = {
      email: string;
      id: string;
      image: string | null;
      name: string | null;
    };
    const existingAccount = await database.query<OAuthUser>(
      `SELECT u.id,u.name,u.email,u.image FROM accounts a
       JOIN users u ON u.id=a."userId"
       WHERE a.provider=$1 AND a."providerAccountId"=$2`,
      [input.provider, providerAccountId],
    );
    const user = existingAccount.rows[0]
      ? existingAccount
      : await database.query<OAuthUser>(
      `WITH saved_user AS (
         INSERT INTO users(name,email,image) VALUES($1,$2,$3)
         ON CONFLICT(email) DO UPDATE SET
          name=COALESCE(users.name,EXCLUDED.name),
          image=COALESCE(users.image,EXCLUDED.image),updated_at=now()
         RETURNING id,name,email,image
       ), linked AS (
         INSERT INTO accounts("userId",type,provider,"providerAccountId")
         SELECT id,'oauth',$4,$5 FROM saved_user
         ON CONFLICT(provider,"providerAccountId") DO NOTHING
       )
       SELECT id,name,email,image FROM saved_user`,
      [
        profile.name || profile.login || null,
        email,
        profile.picture || profile.avatar_url || null,
        input.provider,
        providerAccountId,
      ],
    );
    const account = user.rows[0];
    if (!account) {
      return jsonError(context, 500, "oauth_failed", "Account could not be created");
    }
    const code = randomBytes(32).toString("base64url");
    await database.query(
      `INSERT INTO mobile_oauth_codes
        (code_hash,user_id,code_challenge,state_hash,expires_at)
       VALUES($1,$2,$3,$4,now() + interval '2 minutes')`,
      [
        hashAuthIdentifier(code),
        account.id,
        input.code_challenge,
        hashAuthIdentifier(input.state),
      ],
    );
    const callback = new URL("careergroove://auth/callback");
    callback.searchParams.set("code", code);
    callback.searchParams.set("state", input.state);
    return context.redirect(callback.toString(), 302);
  });

  routes.post("/oauth/exchange", async (context) => {
    const parsed = z.object({
      code: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
      state: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
      codeVerifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
      deviceName: z.string().trim().max(120).optional(),
      platform: z.enum(["ios", "android", "web"]).default("ios"),
    }).strict().safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(context, 401, "invalid_oauth_code", "Invalid authorization code");
    }
    const input = parsed.data;
    const challenge = createHash("sha256")
      .update(input.codeVerifier, "ascii")
      .digest("base64url");
    const result = await database.query<{ user_id: string }>(
      `UPDATE mobile_oauth_codes SET used_at=now()
       WHERE code_hash=$1 AND state_hash=$2 AND code_challenge=$3
        AND used_at IS NULL AND expires_at > now() RETURNING user_id`,
      [
        hashAuthIdentifier(input.code),
        hashAuthIdentifier(input.state),
        challenge,
      ],
    );
    const userId = result.rows[0]?.user_id;
    if (!userId) {
      return jsonError(context, 401, "invalid_oauth_code", "Invalid authorization code");
    }
    const [tokens, profile] = await Promise.all([
      sessions.create(userId, {
        deviceName: input.deviceName,
        platform: input.platform,
      }),
      database.query("SELECT id,name,email,image FROM users WHERE id=$1", [userId]),
    ]);
    context.header("Cache-Control", "no-store");
    return context.json({ ...tokens, user: profile.rows[0] });
  });

  routes.post("/apple", async (context) => {
    if (!config.appleIosClientId) {
      return jsonError(
        context,
        503,
        "provider_unavailable",
        "Sign in with Apple is not configured",
      );
    }
    const parsed = z
      .object({
        identityToken: z.string().min(100).max(10_000),
        nonce: z.string().min(32).max(256),
        givenName: z.string().trim().max(100).optional(),
        familyName: z.string().trim().max(100).optional(),
        deviceName: z.string().trim().max(120).optional(),
      })
      .strict()
      .safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(context, 401, "invalid_apple_auth", "Invalid Apple authorization");
    }
    try {
      const { payload } = await jwtVerify(parsed.data.identityToken, appleKeys, {
        audience: config.appleIosClientId,
        issuer: "https://appleid.apple.com",
      });
      const nonce = createHash("sha256")
        .update(parsed.data.nonce, "utf8")
        .digest("hex");
      if (!payload.sub || !payload.jti || payload.nonce !== nonce) {
        return jsonError(context, 401, "invalid_apple_auth", "Invalid Apple authorization");
      }
      const expiresAt = new Date((payload.exp ?? 0) * 1_000);
      if (expiresAt.getTime() <= Date.now()) {
        return jsonError(context, 401, "apple_auth_expired", "Apple authorization expired");
      }
      const claim = await database.query(
        `INSERT INTO mobile_identity_assertions(assertion_id,expires_at)
         VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING assertion_id`,
        [payload.jti, expiresAt],
      );
      if (!claim.rows[0]) {
        return jsonError(context, 401, "apple_auth_replayed", "Apple authorization was already used");
      }
      type AppleUser = {
        email: string;
        id: string;
        image: string | null;
        name: string | null;
      };
      const existing = await database.query<AppleUser>(
        `SELECT u.id,u.name,u.email,u.image FROM accounts a
         JOIN users u ON u.id=a."userId"
         WHERE a.provider='apple' AND a."providerAccountId"=$1`,
        [payload.sub],
      );
      let user = existing.rows[0];
      if (!user) {
        const emailVerified =
          payload.email_verified === true || payload.email_verified === "true";
        const email =
          typeof payload.email === "string" && emailVerified
            ? payload.email.toLowerCase()
            : null;
        if (!email) {
          return jsonError(
            context,
            401,
            "verified_email_required",
            "Apple did not provide a verified email address",
          );
        }
        const name =
          [parsed.data.givenName, parsed.data.familyName]
            .filter(Boolean)
            .join(" ") || null;
        const created = await database.query<AppleUser>(
          `WITH saved_user AS (
             INSERT INTO users(name,email) VALUES($1,$2)
             ON CONFLICT(email) DO UPDATE SET
              name=COALESCE(users.name,EXCLUDED.name),updated_at=now()
             RETURNING id,name,email,image
           ), linked AS (
             INSERT INTO accounts("userId",type,provider,"providerAccountId")
             SELECT id,'oidc','apple',$3 FROM saved_user
             ON CONFLICT(provider,"providerAccountId") DO NOTHING
           )
           SELECT id,name,email,image FROM saved_user`,
          [name, email, payload.sub],
        );
        user = created.rows[0];
      }
      if (!user) {
        return jsonError(context, 500, "apple_auth_failed", "Account could not be created");
      }
      const tokens = await sessions.create(user.id, {
        deviceName: parsed.data.deviceName,
        platform: "ios",
      });
      context.header("Cache-Control", "no-store");
      return context.json({ ...tokens, user });
    } catch {
      return jsonError(
        context,
        401,
        "invalid_apple_auth",
        "Apple authorization could not be verified",
      );
    }
  });

  routes.post("/signin", async (context) => {
    const parsed = credentialsLoginSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success) {
      return jsonError(
        context,
        401,
        "invalid_credentials",
        "Invalid credentials",
      );
    }
    const input = parsed.data;
    const identifierHash = hashAuthIdentifier(input.email);
    const networkHash = hashAuthIdentifier(clientAddress(context.req.raw.headers));

    await database.query(
      "DELETE FROM mobile_auth_attempts WHERE attempted_at < now() - interval '1 day'",
    );
    const attempts = await database.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM mobile_auth_attempts
       WHERE identifier_hash=$1 AND network_hash=$2
         AND attempted_at > now() - interval '15 minutes'`,
      [identifierHash, networkHash],
    );
    if ((attempts.rows[0]?.count ?? 0) >= 5) {
      context.header("Retry-After", "900");
      return jsonError(
        context,
        429,
        "rate_limited",
        "Too many sign-in attempts. Try again later.",
      );
    }

    const result = await database.query<CredentialUser>(
      `SELECT id,name,email,image,password_hash
       FROM users WHERE lower(email)=$1`,
      [input.email],
    );
    const user = result.rows[0];
    const passwordValid =
      Boolean(user?.password_hash) &&
      (await compare(input.password, user?.password_hash ?? ""));
    if (!user || !passwordValid) {
      await database.query(
        `INSERT INTO mobile_auth_attempts(identifier_hash,network_hash)
         VALUES($1,$2)`,
        [identifierHash, networkHash],
      );
      return jsonError(
        context,
        401,
        "invalid_credentials",
        "Invalid credentials",
      );
    }

    await database.query(
      "DELETE FROM mobile_auth_attempts WHERE identifier_hash=$1",
      [identifierHash],
    );
    const tokens = await sessions.create(user.id, {
      deviceName: input.deviceName,
      platform: input.platform,
    });
    context.header("Cache-Control", "no-store");
    return context.json({
      ...tokens,
      user: {
        email: user.email,
        id: user.id,
        image: user.image,
        name: user.name,
      },
    });
  });

  routes.post("/refresh", async (context) => {
    const parsed = tokenRefreshSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    const tokens = parsed.success
      ? await sessions.rotate(parsed.data.refreshToken)
      : null;
    if (!tokens) {
      return jsonError(
        context,
        401,
        "invalid_refresh_token",
        "Invalid refresh token",
      );
    }
    context.header("Cache-Control", "no-store");
    return context.json(tokens);
  });

  routes.post("/signout", async (context) => {
    const parsed = tokenRefreshSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (parsed.success) await sessions.revoke(parsed.data.refreshToken);
    return context.body(null, 204);
  });

  return routes;
}
