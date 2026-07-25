import { RegisterForm } from "@/components/register-form";
import { isBillingPlan } from "@/lib/stripe";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  return <main className="grid min-h-dvh place-items-center p-6"><RegisterForm plan={isBillingPlan(plan) ? plan : undefined}/></main>;
}
