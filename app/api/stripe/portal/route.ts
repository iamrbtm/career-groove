import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in to manage billing." }, { status: 401 });
  const result = await db.query<{ stripeCustomerId: string | null }>(`SELECT "stripeCustomerId" FROM users WHERE id = $1`, [session.user.id]);
  const customerId = result.rows[0]?.stripeCustomerId;
  if (!customerId) return NextResponse.json({ error: "No Stripe billing account exists yet." }, { status: 404 });
  try {
    const portal = await getStripe().billingPortal.sessions.create({ customer: customerId, return_url: `${process.env.AUTH_URL || request.nextUrl.origin}/billing` });
    return NextResponse.json({ url: portal.url });
  } catch (error) {
    console.error("Stripe portal failed", error);
    return NextResponse.json({ error: "The billing portal is temporarily unavailable." }, { status: 500 });
  }
}
