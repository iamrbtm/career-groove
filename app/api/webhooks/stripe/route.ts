import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import Stripe from "stripe";

export const runtime = "nodejs";

function idOf(value: string | { id: string } | null) {
  return typeof value === "string" ? value : value?.id ?? null;
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const customerId = idOf(subscription.customer);
  const item = subscription.items.data[0];
  const periodEnd = item?.current_period_end ? new Date(item.current_period_end * 1000) : null;
  const userId = subscription.metadata.userId;
  await db.query(
    `UPDATE users SET
      "stripeCustomerId" = COALESCE($2, "stripeCustomerId"),
      "stripeSubscriptionId" = $3,
      "stripePriceId" = $4,
      "stripeCurrentPeriodEnd" = $5,
      "subscriptionStatus" = $6,
      updated_at = now()
     WHERE ${userId ? "id = $1" : '"stripeCustomerId" = $2'}`,
    [userId || null, customerId, subscription.id, item?.price.id ?? null, periodEnd, subscription.status],
  );
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) return new Response("Webhook configuration missing", { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const checkout = event.data.object;
      const userId = checkout.client_reference_id || checkout.metadata?.userId;
      const customerId = idOf(checkout.customer);
      const subscriptionId = idOf(checkout.subscription);
      if (subscriptionId) {
        await syncSubscription(await getStripe().subscriptions.retrieve(subscriptionId));
      } else if (userId && checkout.payment_status === "paid") {
        await db.query(
          `UPDATE users SET "stripeCustomerId" = COALESCE($2, "stripeCustomerId"), "stripePriceId" = $3,
           "stripeCurrentPeriodEnd" = NULL, "subscriptionStatus" = 'lifetime', updated_at = now() WHERE id = $1`,
          [userId, customerId, checkout.metadata?.plan === "lifetime" ? process.env.STRIPE_PRICE_LIFETIME : null],
        );
      }
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      await syncSubscription(event.data.object);
    }
  } catch (error) {
    console.error(`Stripe webhook processing failed for ${event.id}`, error);
    return new Response("Webhook processing failed", { status: 500 });
  }

  return Response.json({ received: true });
}
