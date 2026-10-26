import { requireUser, unauthorized } from "@/lib/api-auth";
import { getOnboardingSteps, isOnboardingComplete } from "@/lib/onboarding";

export async function GET() {
  const userId = await requireUser();
  if (!userId) return unauthorized();
  const steps = await getOnboardingSteps(userId);
  return Response.json({ complete: isOnboardingComplete(steps), steps });
}
