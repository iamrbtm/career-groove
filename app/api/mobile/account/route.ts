import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";
import { getStripe } from "@/lib/stripe";

const inputSchema = z.object({ confirmation: z.literal("DELETE") });

export async function DELETE(request: Request) {
  const userId = await requireUser();
  if (!userId) return unauthorized();
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Account deletion was not confirmed." }, { status: 400 });

  const account = await db.query<{ stripeSubscriptionId: string | null }>(
    `SELECT "stripeSubscriptionId" FROM users WHERE id=$1`,
    [userId],
  );
  const subscriptionId = account.rows[0]?.stripeSubscriptionId;
  if (subscriptionId) {
    try {
      await getStripe().subscriptions.cancel(subscriptionId);
    } catch (error) {
      console.error("Stripe cancellation during account deletion failed", error);
      return Response.json(
        { error: "The web subscription could not be canceled. The account was not deleted." },
        { status: 502 },
      );
    }
  }

  await db.query("DELETE FROM users WHERE id=$1", [userId]);
  return new Response(null, { status: 204 });
}
