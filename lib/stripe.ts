import Stripe from "stripe";

let stripeClient: Stripe | undefined;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured.");
  stripeClient ??= new Stripe(secretKey);
  return stripeClient;
}

export const priceIds = {
  monthly: process.env.STRIPE_PRICE_MONTHLY,
  yearly: process.env.STRIPE_PRICE_YEARLY,
  lifetime: process.env.STRIPE_PRICE_LIFETIME,
} as const;

export type BillingPlan = keyof typeof priceIds;

export function isBillingPlan(value: unknown): value is BillingPlan {
  return value === "monthly" || value === "yearly" || value === "lifetime";
}
