import { Hono } from "hono";
import { z } from "zod";
import { hash } from "bcryptjs";
import { createHash } from "node:crypto";

import type { Database } from "../../db.js";
import type { AppVariables } from "../../http.js";
import { jsonError } from "../../http.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import type { SessionService } from "../auth/session-service.js";

interface AccountRouteDependencies {
  database: Database;
  sessions: SessionService;
}

const profileInput = z
  .object({
    name: z.string().trim().min(2).max(100),
    phone: z.string().trim().max(40).default(""),
  })
  .strict();

const registrationInput = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email().max(320),
    password: z
      .string()
      .min(10)
      .max(128)
      .regex(/[a-zA-Z]/)
      .regex(/\d/),
  })
  .strict();

export function createRegistrationRoutes({ database }: { database: Database }) {
  const routes = new Hono<{ Variables: AppVariables }>();
  routes.post("/", async (context) => {
    const parsed = registrationInput.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success) {
      return jsonError(
        context,
        400,
        "invalid_registration",
        "Enter a valid name, email, and password of at least 10 characters with a letter and number",
        parsed.error.flatten(),
      );
    }
    const input = parsed.data;
    const passwordHash = await hash(input.password, 12);
    try {
      const result = await database.query(
        `INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3)
         RETURNING id,name,email,created_at AS "createdAt"`,
        [input.name, input.email, passwordHash],
      );
      return context.json({ user: result.rows[0] }, 201);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
      ) {
        return jsonError(
          context,
          409,
          "account_exists",
          "An account already exists for this email",
        );
      }
      throw error;
    }
  });
  return routes;
}

export function createProfileRoutes({
  database,
  sessions,
}: AccountRouteDependencies) {
  const routes = new Hono<{ Variables: AppVariables }>();
  routes.use("*", createAuthMiddleware(sessions));

  routes.get("/", async (context) => {
    const result = await database.query(
      `SELECT id,name,email,image,
        COALESCE(preferences->>'phone','') AS phone,
        created_at AS "createdAt"
       FROM users WHERE id=$1`,
      [context.get("userId")],
    );
    const profile = result.rows[0];
    if (!profile) {
      return jsonError(context, 404, "profile_not_found", "Profile not found");
    }
    context.header("Cache-Control", "no-store");
    return context.json({ profile });
  });

  routes.patch("/", async (context) => {
    const parsed = profileInput.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success) {
      return jsonError(
        context,
        400,
        "invalid_profile",
        "Enter a valid name and a phone number no longer than 40 characters",
        parsed.error.flatten(),
      );
    }
    const result = await database.query(
      `UPDATE users SET name=$2,
        preferences=CASE WHEN $3='' THEN preferences-'phone'
          ELSE jsonb_set(preferences,'{phone}',to_jsonb($3::text),true) END,
        updated_at=now()
       WHERE id=$1
       RETURNING id,name,email,image,
        COALESCE(preferences->>'phone','') AS phone,
        created_at AS "createdAt"`,
      [context.get("userId"), parsed.data.name, parsed.data.phone],
    );
    const profile = result.rows[0];
    if (!profile) {
      return jsonError(context, 404, "profile_not_found", "Profile not found");
    }
    context.header("Cache-Control", "no-store");
    return context.json({ profile });
  });

  return routes;
}

export function createBillingStatusRoutes({
  database,
  sessions,
}: AccountRouteDependencies) {
  const routes = new Hono<{ Variables: AppVariables }>();
  routes.use("*", createAuthMiddleware(sessions));
  routes.get("/", async (context) => {
    const result = await database.query<{
      appStoreExpiresAt: string | Date | null;
      appStoreProductId: string | null;
      stripeCurrentPeriodEnd: string | Date | null;
      stripeStatus: string | null;
    }>(
      `SELECT "subscriptionStatus" AS "stripeStatus",
        "stripeCurrentPeriodEnd",
        "appStoreProductId",
        "appStoreExpiresAt"
       FROM users WHERE id=$1`,
      [context.get("userId")],
    );
    const billing = result.rows[0] ?? {
      appStoreExpiresAt: null,
      appStoreProductId: null,
      stripeCurrentPeriodEnd: null,
      stripeStatus: null,
    };
    const appStoreActive =
      billing.appStoreExpiresAt != null &&
      new Date(billing.appStoreExpiresAt).getTime() > Date.now();
    context.header("Cache-Control", "no-store");
    return context.json({
      source: appStoreActive
        ? "app_store"
        : billing.stripeStatus
          ? "stripe"
          : null,
      status: appStoreActive
        ? "active"
        : (billing.stripeStatus ?? "inactive"),
      productId: appStoreActive ? billing.appStoreProductId : null,
      expiresAt: appStoreActive
        ? billing.appStoreExpiresAt
        : (billing.stripeCurrentPeriodEnd ?? null),
    });
  });
  return routes;
}

const pushCategories = [
  "interview_reminder",
  "application_follow_up",
  "document_status",
  "command_session_action",
  "subscription_status",
] as const;
const pushToken = z.string().regex(/^[0-9a-fA-F]{64,256}$/);
const pushRegistration = z
  .object({
    deviceToken: pushToken,
    environment: z.enum(["sandbox", "production"]),
    enabledCategories: z.array(z.enum(pushCategories)).max(
      pushCategories.length,
    ),
    appVersion: z.string().max(40).optional(),
    locale: z.string().max(40).optional(),
  })
  .strict();
const pushTokenHash = (value: string) =>
  createHash("sha256").update(value.toLowerCase()).digest("hex");

export function createPushDeviceRoutes({
  database,
  sessions,
}: AccountRouteDependencies) {
  const routes = new Hono<{ Variables: AppVariables }>();
  routes.use("*", createAuthMiddleware(sessions));
  routes.put("/", async (context) => {
    const parsed = pushRegistration.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success) {
      return jsonError(
        context,
        400,
        "invalid_push_device",
        "Invalid push-device registration",
        parsed.error.flatten(),
      );
    }
    const input = parsed.data;
    await database.query(
      `INSERT INTO push_devices
        (user_id,token_hash,device_token,environment,enabled_categories,app_version,locale)
       VALUES($1,$2,$3,$4,$5::jsonb,$6,$7)
       ON CONFLICT(token_hash) DO UPDATE SET
        user_id=EXCLUDED.user_id,device_token=EXCLUDED.device_token,
        environment=EXCLUDED.environment,
        enabled_categories=EXCLUDED.enabled_categories,
        app_version=EXCLUDED.app_version,locale=EXCLUDED.locale,
        last_seen_at=now(),updated_at=now()`,
      [
        context.get("userId"),
        pushTokenHash(input.deviceToken),
        input.deviceToken.toLowerCase(),
        input.environment,
        JSON.stringify(input.enabledCategories),
        input.appVersion ?? null,
        input.locale ?? null,
      ],
    );
    return context.body(null, 204);
  });
  routes.delete("/", async (context) => {
    const parsed = z
      .object({ deviceToken: pushToken })
      .strict()
      .safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(
        context,
        400,
        "invalid_device_token",
        "Invalid device token",
      );
    }
    await database.query(
      "DELETE FROM push_devices WHERE user_id=$1 AND token_hash=$2",
      [context.get("userId"), pushTokenHash(parsed.data.deviceToken)],
    );
    return context.body(null, 204);
  });
  return routes;
}
