import { Dashboard } from "@/components/dashboard";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin?callbackUrl=/dashboard");
  return <AppShell><Dashboard /></AppShell>;
}
