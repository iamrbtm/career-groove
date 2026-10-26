import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getOnboardingSteps, isOnboardingComplete, emptyOnboardingSteps } from "@/lib/onboarding";
import { FirstRunWizard } from "@/components/first-run-wizard";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/onboarding");
  const result = await db.query(`SELECT name FROM users WHERE id=$1`, [session.user.id]);
  if (!result.rows[0]) redirect("/signin");
  const steps = await getOnboardingSteps(session.user.id);
  if (isOnboardingComplete(steps)) redirect("/dashboard");
  const name = typeof result.rows[0].name === "string" ? result.rows[0].name : "";
  return <FirstRunWizard name={name} steps={steps ?? emptyOnboardingSteps} />;
}
