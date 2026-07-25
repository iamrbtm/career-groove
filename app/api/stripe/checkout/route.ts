import { requireUser } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getStripe, isBillingPlan, priceIds } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function appUrl(request: NextRequest) {
  return process.env.AUTH_URL || request.nextUrl.origin;
}

async function startCheckout(request: NextRequest, rawPlan: unknown) {
  if (!isBillingPlan(rawPlan)) {
    return NextResponse.json({ error: "Choose a valid pricing plan." }, { status: 400 });
  }

  const userId = await requireUser();
  if (!userId) {
    const registerUrl = new URL("/register", appUrl(request));
    registerUrl.searchParams.set("plan", rawPlan);
    return NextResponse.json(
      { error: "Sign in or create an account to continue.", redirectUrl: registerUrl.toString() },
      { status: 401 },
    );
  }

  const priceId = priceIds[rawPlan];
  if (!priceId) {
    return NextResponse.json({ error: `Stripe pricing for ${rawPlan} is not configured.` }, { status: 503 });
  }

  const result = await db.query<{ email: string; stripeCustomerId: string | null }>(
    `SELECT email, "stripeCustomerId" FROM users WHERE id = $1`,
    [userId],
  );
  const user = result.rows[0];
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  try {
    const stripe = getStripe();
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId },
      });
      customerId = customer.id;
      await db.query(`UPDATE users SET "stripeCustomerId" = $2, updated_at = now() WHERE id = $1`, [userId, customerId]);
    }

    const checkout = await stripe.checkout.sessions.create({
      mode: rawPlan === "lifetime" ? "payment" : "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: rawPlan !== "lifetime",
      client_reference_id: userId,
      metadata: { userId, plan: rawPlan },
      subscription_data: rawPlan === "lifetime" ? undefined : { metadata: { userId, plan: rawPlan } },
      success_url: `${appUrl(request)}/dashboard?checkout=success`,
      cancel_url: `${appUrl(request)}/?checkout=canceled#pricing`,
    });

    if (!checkout.url) throw new Error("Stripe did not return a Checkout URL.");
    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error("Stripe Checkout failed", error);
    return NextResponse.json({ error: "Checkout is temporarily unavailable. Please try again." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  return startCheckout(request, body?.plan);
}

export async function GET(request: NextRequest) {
  const response = await startCheckout(request, request.nextUrl.searchParams.get("plan"));
  const body = await response.clone().json().catch(() => null);
  if (response.ok && body?.url) return NextResponse.redirect(body.url, 303);
  if (response.status === 401 && body?.redirectUrl) return NextResponse.redirect(body.redirectUrl, 303);
  const fallback = new URL("/", appUrl(request));
  fallback.searchParams.set("checkout", "error");
  return NextResponse.redirect(fallback, 303);
}
