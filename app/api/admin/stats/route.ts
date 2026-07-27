import { db } from "@/lib/db";
import { requireUser, unauthorized, isAdmin, getSetting } from "@/lib/api-auth";

export async function GET() {
  const user = await requireUser();
  if (!user || !(await isAdmin(user))) return unauthorized();
  const [total, pro, free, pastDue] = await Promise.all([
    db.query("SELECT COUNT(*) FROM users"),
    db.query(`SELECT COUNT(*) FROM users WHERE "subscriptionStatus" IN ('active','trialing','lifetime')`),
    db.query(`SELECT COUNT(*) FROM users WHERE "subscriptionStatus" IS NULL OR "subscriptionStatus" IN ('inactive','past_due','unpaid')`),
    db.query(`SELECT COUNT(*) FROM users WHERE "subscriptionStatus" = 'past_due'`),
  ]);
  const stripeConfig = await getSetting("stripe_config");
  const monthlyPrice = stripeConfig?.price_monthly ? parseFloat(stripeConfig.price_monthly as string) : 15;
  const proCount = parseInt(pro.rows[0]?.count || "0", 10);
  return Response.json({
    totalUsers: parseInt(total.rows[0]?.count || "0", 10),
    proUsers: proCount,
    freeUsers: parseInt(free.rows[0]?.count || "0", 10),
    pastDueUsers: parseInt(pastDue.rows[0]?.count || "0", 10),
    estimatedMRR: proCount * monthlyPrice,
    monthlyPrice,
  });
}
