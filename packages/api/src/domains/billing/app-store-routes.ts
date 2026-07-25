import {
  Environment,
  SignedDataVerifier,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from "@apple/app-store-server-library";
import { Hono } from "hono";
import { z } from "zod";

import type { Database } from "../../db.js";
import type { AppVariables } from "../../http.js";
import { jsonError } from "../../http.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import type { SessionService } from "../auth/session-service.js";

type VerifiedTransaction = {
  environment: Environment | string;
  transaction: JWSTransactionDecodedPayload;
};
type VerifiedNotification = {
  environment: Environment | string;
  notification: ResponseBodyV2DecodedPayload;
  transaction: JWSTransactionDecodedPayload | null;
};

export interface AppStoreVerifier {
  verifyNotification(signedPayload: string): Promise<VerifiedNotification>;
  verifyTransaction(signedTransaction: string): Promise<VerifiedTransaction>;
}

interface Dependencies {
  appStore?: AppStoreVerifier;
  database: Database;
  sessions: SessionService;
}

const defaultBundleId = "website.careergroove.app";
const defaultProducts = new Set([
  "website.careergroove.app.pro.monthly",
  "website.careergroove.app.pro.yearly",
]);

function products() {
  const configured = (process.env.APP_STORE_PRODUCT_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return configured.length ? new Set(configured) : defaultProducts;
}

function productAllowed(productId?: string) {
  return Boolean(productId && products().has(productId));
}

function subscriptionState(transaction: JWSTransactionDecodedPayload) {
  const expiresAt = transaction.expiresDate
    ? new Date(transaction.expiresDate)
    : null;
  const active = Boolean(
    productAllowed(transaction.productId) &&
      expiresAt &&
      expiresAt.getTime() > Date.now() &&
      !transaction.revocationDate,
  );
  return {
    expiresAt,
    status: transaction.revocationDate ? "revoked" : active ? "active" : "expired",
  };
}

function configuredVerifier(): AppStoreVerifier | null {
  const encodedRoots = process.env.APP_STORE_ROOT_CA_BASE64;
  if (!encodedRoots) return null;
  let roots: Buffer[];
  try {
    const values = JSON.parse(encodedRoots) as unknown;
    if (!Array.isArray(values) || !values.every((value) => typeof value === "string")) {
      return null;
    }
    roots = values.map((value) => Buffer.from(value, "base64"));
  } catch {
    return null;
  }
  const bundleId = process.env.APP_STORE_BUNDLE_ID ?? defaultBundleId;
  const appAppleId = process.env.APP_STORE_APP_APPLE_ID
    ? Number(process.env.APP_STORE_APP_APPLE_ID)
    : undefined;
  const attempts: Array<[Environment, number | undefined]> = [
    [Environment.SANDBOX, undefined],
    [Environment.PRODUCTION, appAppleId],
  ];
  async function attempt<T>(
    callback: (verifier: SignedDataVerifier) => Promise<T>,
  ): Promise<{ environment: Environment; value: T }> {
    let lastError: unknown;
    for (const [environment, appleId] of attempts) {
      if (environment === Environment.PRODUCTION && !appleId) continue;
      try {
        const verifier = new SignedDataVerifier(
          roots,
          true,
          environment,
          bundleId,
          appleId,
        );
        return { environment, value: await callback(verifier) };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error("App Store verification failed");
  }
  return {
    async verifyNotification(signedPayload) {
      const verified = await attempt((verifier) =>
        verifier.verifyAndDecodeNotification(signedPayload),
      );
      const transaction = verified.value.data?.signedTransactionInfo
        ? await new SignedDataVerifier(
            roots,
            true,
            verified.environment,
            bundleId,
            verified.environment === Environment.PRODUCTION
              ? appAppleId
              : undefined,
          ).verifyAndDecodeTransaction(
            verified.value.data.signedTransactionInfo,
          )
        : null;
      return {
        environment: verified.environment,
        notification: verified.value,
        transaction,
      };
    },
    async verifyTransaction(signedTransaction) {
      const verified = await attempt((verifier) =>
        verifier.verifyAndDecodeTransaction(signedTransaction),
      );
      return {
        environment: verified.environment,
        transaction: verified.value,
      };
    },
  };
}

export function createStoreKitRoutes(dependencies: Dependencies) {
  const routes = new Hono<{ Variables: AppVariables }>();
  routes.use("*", createAuthMiddleware(dependencies.sessions));
  routes.post("/", async (context) => {
    const input = z
      .object({ signedTransaction: z.string().min(100).max(100_000) })
      .strict()
      .safeParse(await context.req.json().catch(() => null));
    if (!input.success) {
      return jsonError(context, 400, "invalid_transaction", "Invalid StoreKit transaction");
    }
    const verifier = dependencies.appStore ?? configuredVerifier();
    if (!verifier) {
      return jsonError(
        context,
        503,
        "app_store_unavailable",
        "App Store verification is not configured",
      );
    }
    try {
      const { environment, transaction } = await verifier.verifyTransaction(
        input.data.signedTransaction,
      );
      const userId = context.get("userId");
      if (
        !transaction.originalTransactionId ||
        !transaction.transactionId ||
        !transaction.appAccountToken ||
        transaction.appAccountToken.toLowerCase() !== userId.toLowerCase() ||
        !productAllowed(transaction.productId)
      ) {
        return jsonError(
          context,
          403,
          "purchase_owner_mismatch",
          "This purchase does not belong to this account",
        );
      }
      const state = subscriptionState(transaction);
      await dependencies.database.query(
        `UPDATE users SET
          "appStoreOriginalTransactionId"=$2,"appStoreProductId"=$3,
          "appStoreEnvironment"=$4,"appStoreExpiresAt"=$5,updated_at=now()
         WHERE id=$1`,
        [
          userId,
          transaction.originalTransactionId,
          transaction.productId,
          String(environment),
          state.expiresAt,
        ],
      );
      return context.json({
        expiresAt: state.expiresAt?.toISOString() ?? null,
        productId: transaction.productId,
        status: state.status,
      });
    } catch {
      return jsonError(
        context,
        400,
        "verification_failed",
        "The App Store purchase could not be verified",
      );
    }
  });
  return routes;
}

export function createAppStoreWebhookRoutes(dependencies: Dependencies) {
  const routes = new Hono<{ Variables: AppVariables }>();
  routes.post("/", async (context) => {
    const input = z
      .object({ signedPayload: z.string().min(100).max(500_000) })
      .strict()
      .safeParse(await context.req.json().catch(() => null));
    if (!input.success) {
      return jsonError(context, 400, "invalid_payload", "Invalid payload");
    }
    const verifier = dependencies.appStore ?? configuredVerifier();
    if (!verifier) {
      return jsonError(
        context,
        503,
        "app_store_unavailable",
        "App Store verification is not configured",
      );
    }
    try {
      const { environment, notification, transaction } =
        await verifier.verifyNotification(input.data.signedPayload);
      if (!notification.notificationUUID) {
        return jsonError(
          context,
          400,
          "missing_notification_id",
          "Missing notification identifier",
        );
      }
      const inserted = await dependencies.database.query(
        `INSERT INTO app_store_notifications
          (notification_id,notification_type,environment)
         VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING notification_id`,
        [
          notification.notificationUUID,
          notification.notificationType ?? null,
          String(environment),
        ],
      );
      if (
        !inserted.rows[0] ||
        !transaction?.originalTransactionId ||
        !productAllowed(transaction.productId)
      ) {
        return context.body(null, 204);
      }
      const state = subscriptionState(transaction);
      await dependencies.database.query(
        `UPDATE users SET
          "appStoreOriginalTransactionId"=$1,"appStoreProductId"=$2,
          "appStoreEnvironment"=$3,"appStoreExpiresAt"=$4,updated_at=now()
         WHERE "appStoreOriginalTransactionId"=$1
          OR ($5::uuid IS NOT NULL AND id=$5::uuid)`,
        [
          transaction.originalTransactionId,
          transaction.productId,
          String(environment),
          state.expiresAt,
          transaction.appAccountToken ?? null,
        ],
      );
      return context.body(null, 204);
    } catch {
      return jsonError(
        context,
        401,
        "invalid_signature",
        "Invalid App Store signature",
      );
    }
  });
  return routes;
}
