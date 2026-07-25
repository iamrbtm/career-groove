import { compare } from "bcryptjs";
import { Hono } from "hono";

import {
  credentialsLoginSchema,
  tokenRefreshSchema,
} from "@career-groove/shared";

import type { Database } from "../../db.js";
import type { AppVariables } from "../../http.js";
import { jsonError } from "../../http.js";
import {
  hashAuthIdentifier,
  type SessionService,
} from "./session-service.js";

interface AuthRouteDependencies {
  database: Database;
  sessions: SessionService;
}

interface CredentialUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  password_hash: string | null;
}

function clientAddress(headers: Headers): string {
  return (
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export function createAuthRoutes({
  database,
  sessions,
}: AuthRouteDependencies) {
  const routes = new Hono<{ Variables: AppVariables }>();

  routes.get("/capabilities", (context) =>
    context.json(
      {
        methods: {
          apple: Boolean(process.env.AUTH_APPLE_IOS_CLIENT_ID),
          credentials: true,
          github: Boolean(
            process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET,
          ),
          google: Boolean(
            process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
          ),
          passkey: process.env.AUTH_EXPERIMENTAL_ENABLE_PASSKEYS === "true",
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
