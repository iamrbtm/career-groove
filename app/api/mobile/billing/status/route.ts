import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

export async function GET() {
  const userId = await requireUser();
  if (!userId) return unauthorized();
  const result = await db.query(
    `SELECT "subscriptionStatus" AS "stripeStatus","stripeCurrentPeriodEnd",
      "appStoreProductId","appStoreExpiresAt"
     FROM users WHERE id=$1`,
    [userId],
  );
  const billing = result.rows[0] ?? {};
  const appStoreActive = billing.appStoreExpiresAt && new Date(billing.appStoreExpiresAt) > new Date();
  return Response.json({
    source: appStoreActive ? "app_store" : billing.stripeStatus ? "stripe" : null,
    status: appStoreActive ? "active" : billing.stripeStatus ?? "inactive",
    productId: appStoreActive ? billing.appStoreProductId : null,
    expiresAt: appStoreActive ? billing.appStoreExpiresAt : billing.stripeCurrentPeriodEnd ?? null,
  });
}
