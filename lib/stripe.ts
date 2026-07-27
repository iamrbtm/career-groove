import Stripe from "stripe";
import { db } from "./db";

let stripeClient: Stripe | undefined;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured.");
  stripeClient ??= new Stripe(secretKey);
  return stripeClient;
}

export type BillingPlan = "monthly" | "yearly" | "lifetime";

export function isBillingPlan(value: unknown): value is BillingPlan {
  return value === "monthly" || value === "yearly" || value === "lifetime";
}

let cachedPriceIds: Record<string, string> | null = null;

export async function getPriceIds(): Promise<Record<string, string>> {
  if (cachedPriceIds) return cachedPriceIds;
  const fromEnv: Record<string, string> = {};
  if (process.env.STRIPE_PRICE_MONTHLY) fromEnv.monthly = process.env.STRIPE_PRICE_MONTHLY;
  if (process.env.STRIPE_PRICE_YEARLY) fromEnv.yearly = process.env.STRIPE_PRICE_YEARLY;
  if (process.env.STRIPE_PRICE_LIFETIME) fromEnv.lifetime = process.env.STRIPE_PRICE_LIFETIME;
  if (fromEnv.monthly) { cachedPriceIds = fromEnv; return fromEnv; }
  try {
    const result = await db.query("SELECT value FROM settings WHERE key = 'stripe_config'");
    const config = result.rows[0]?.value;
    if (config) {
      cachedPriceIds = {
        monthly: config.price_monthly || "",
        yearly: config.price_yearly || "",
        lifetime: config.price_lifetime || "",
      };
      return cachedPriceIds;
    }
  } catch {}
  return { monthly: "", yearly: "", lifetime: "" };
}

export function getStripePublishableKey(): string {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
}
