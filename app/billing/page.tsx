import { auth } from "@/auth";
import { BillingPanel } from "@/components/billing-panel";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/billing");
  const result = await db.query(`SELECT "subscriptionStatus" AS status, "stripePriceId" AS "priceId", "stripeCurrentPeriodEnd" AS "periodEnd", ("stripeCustomerId" IS NOT NULL) AS "hasCustomer" FROM users WHERE id = $1`, [session.user.id]);
  if (!result.rows[0]) redirect("/signin");
  return <BillingPanel billing={result.rows[0]}/>;
}
