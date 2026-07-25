import { Hono } from "hono";
import Stripe from "stripe";
import { z } from "zod";

import type { ApiConfig } from "../../config.js";
import type { Database } from "../../db.js";
import type { AppVariables } from "../../http.js";
import { jsonError } from "../../http.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import type { SessionService } from "../auth/session-service.js";

export type StripeClient = Stripe;

interface Dependencies {
  config: ApiConfig;
  database: Database;
  sessions: SessionService;
  stripe?: StripeClient;
}

const planSchema = z
  .object({ plan: z.enum(["monthly", "yearly", "lifetime"]) })
  .strict();

function stripeClient(dependencies: Dependencies): StripeClient | null {
  if (dependencies.stripe) return dependencies.stripe;
  return dependencies.config.stripeSecretKey
    ? new Stripe(dependencies.config.stripeSecretKey)
    : null;
}

function objectId(value: string | { id: string } | null): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

async function syncSubscription(
  database: Database,
  subscription: Stripe.Subscription,
) {
  const customerId = objectId(subscription.customer);
  const item = subscription.items.data[0];
  const periodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1_000)
    : null;
  const userId = subscription.metadata.userId;
  await database.query(
    `UPDATE users SET
      "stripeCustomerId"=COALESCE($2,"stripeCustomerId"),
      "stripeSubscriptionId"=$3,"stripePriceId"=$4,
      "stripeCurrentPeriodEnd"=$5,"subscriptionStatus"=$6,updated_at=now()
     WHERE CASE WHEN $1::uuid IS NOT NULL THEN id=$1
      ELSE "stripeCustomerId"=$2 END`,
    [
      userId || null,
      customerId,
      subscription.id,
      item?.price.id ?? null,
      periodEnd,
      subscription.status,
    ],
  );
}

export function createStripeRoutes(dependencies: Dependencies) {
  const routes = new Hono<{ Variables: AppVariables }>();
  routes.use("*", createAuthMiddleware(dependencies.sessions));

  routes.post("/checkout", async (context) => {
    const parsed = planSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success) {
      return jsonError(context, 400, "invalid_plan", "Choose a valid pricing plan");
    }
    const client = stripeClient(dependencies);
    const prices = {
      lifetime: dependencies.config.stripePriceLifetime,
      monthly: dependencies.config.stripePriceMonthly,
      yearly: dependencies.config.stripePriceYearly,
    };
    const price = prices[parsed.data.plan];
    if (!client || !price) {
      return jsonError(
        context,
        503,
        "billing_unavailable",
        "Billing is not configured",
      );
    }
    const userId = context.get("userId");
    const result = await dependencies.database.query<{
      email: string;
      stripeCustomerId: string | null;
    }>(
      `SELECT email,"stripeCustomerId" FROM users WHERE id=$1`,
      [userId],
    );
    const user = result.rows[0];
    if (!user) return jsonError(context, 404, "not_found", "Account not found");

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await client.customers.create({
        email: user.email,
        metadata: { userId },
      });
      customerId = customer.id;
      await dependencies.database.query(
        `UPDATE users SET "stripeCustomerId"=$2,updated_at=now()
         WHERE id=$1`,
        [userId, customerId],
      );
    }
    const origin = dependencies.config.allowedOrigins[0]!;
    const checkout = await client.checkout.sessions.create({
      allow_promotion_codes: parsed.data.plan !== "lifetime",
      cancel_url: `${origin}/?checkout=canceled`,
      client_reference_id: userId,
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      metadata: { plan: parsed.data.plan, userId },
      mode: parsed.data.plan === "lifetime" ? "payment" : "subscription",
      subscription_data:
        parsed.data.plan === "lifetime"
          ? undefined
          : { metadata: { plan: parsed.data.plan, userId } },
      success_url: `${origin}/more?checkout=success`,
    });
    if (!checkout.url) {
      return jsonError(
        context,
        503,
        "billing_unavailable",
        "Checkout is temporarily unavailable",
      );
    }
    return context.json({ url: checkout.url });
  });

  routes.post("/portal", async (context) => {
    const client = stripeClient(dependencies);
    if (!client) {
      return jsonError(context, 503, "billing_unavailable", "Billing is not configured");
    }
    const result = await dependencies.database.query<{
      stripeCustomerId: string | null;
    }>(`SELECT "stripeCustomerId" FROM users WHERE id=$1`, [
      context.get("userId"),
    ]);
    const customerId = result.rows[0]?.stripeCustomerId;
    if (!customerId) {
      return jsonError(context, 404, "not_found", "No billing account exists yet");
    }
    const portal = await client.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${dependencies.config.allowedOrigins[0]!}/more`,
    });
    return context.json({ url: portal.url });
  });

  return routes;
}

export function createStripeWebhookRoutes(dependencies: Dependencies) {
  const routes = new Hono<{ Variables: AppVariables }>();
  routes.post("/", async (context) => {
    const signature = context.req.header("stripe-signature");
    const secret = dependencies.config.stripeWebhookSecret;
    const client = stripeClient(dependencies);
    if (!signature || !secret || !client) {
      return jsonError(
        context,
        400,
        "invalid_webhook",
        "Webhook configuration or signature is missing",
      );
    }
    let event: Stripe.Event;
    try {
      event = client.webhooks.constructEvent(
        await context.req.text(),
        signature,
        secret,
      );
    } catch {
      return jsonError(context, 400, "invalid_signature", "Invalid webhook signature");
    }
    const claim = await dependencies.database.query(
      `INSERT INTO stripe_webhook_events(id,event_type)
       VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id`,
      [event.id, event.type],
    );
    if (!claim.rows[0]) return context.json({ duplicate: true, received: true });
    try {
      if (event.type === "checkout.session.completed") {
        const checkout = event.data.object;
        const userId = checkout.client_reference_id || checkout.metadata?.userId;
        const customerId = objectId(checkout.customer);
        const subscriptionId = objectId(checkout.subscription);
        if (subscriptionId) {
          await syncSubscription(
            dependencies.database,
            await client.subscriptions.retrieve(subscriptionId),
          );
        } else if (userId && checkout.payment_status === "paid") {
          await dependencies.database.query(
            `UPDATE users SET
              "stripeCustomerId"=COALESCE($2,"stripeCustomerId"),
              "stripePriceId"=$3,"stripeCurrentPeriodEnd"=NULL,
              "subscriptionStatus"='lifetime',updated_at=now() WHERE id=$1`,
            [
              userId,
              customerId,
              checkout.metadata?.plan === "lifetime"
                ? dependencies.config.stripePriceLifetime
                : null,
            ],
          );
        }
      } else if (
        event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.deleted"
      ) {
        await syncSubscription(dependencies.database, event.data.object);
      }
      await dependencies.database.query(
        "UPDATE stripe_webhook_events SET processed_at=now() WHERE id=$1",
        [event.id],
      );
      return context.json({ received: true });
    } catch (error) {
      await dependencies.database.query(
        "DELETE FROM stripe_webhook_events WHERE id=$1 AND processed_at IS NULL",
        [event.id],
      );
      throw error;
    }
  });
  return routes;
}

export function createAccountDeletionRoutes(dependencies: Dependencies) {
  const routes = new Hono<{ Variables: AppVariables }>();
  routes.use("*", createAuthMiddleware(dependencies.sessions));
  routes.delete("/", async (context) => {
    const parsed = z
      .object({ confirmation: z.literal("DELETE") })
      .strict()
      .safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(
        context,
        400,
        "deletion_not_confirmed",
        "Account deletion was not confirmed",
      );
    }
    const userId = context.get("userId");
    const account = await dependencies.database.query<{
      stripeSubscriptionId: string | null;
    }>(`SELECT "stripeSubscriptionId" FROM users WHERE id=$1`, [userId]);
    const subscriptionId = account.rows[0]?.stripeSubscriptionId;
    if (subscriptionId) {
      const client = stripeClient(dependencies);
      if (!client) {
        return jsonError(
          context,
          503,
          "billing_unavailable",
          "The subscription could not be canceled, so the account was not deleted",
        );
      }
      try {
        await client.subscriptions.cancel(subscriptionId);
      } catch {
        return jsonError(
          context,
          503,
          "billing_unavailable",
          "The subscription could not be canceled, so the account was not deleted",
        );
      }
    }
    await dependencies.database.query("DELETE FROM users WHERE id=$1", [userId]);
    return context.body(null, 204);
  });
  return routes;
}
