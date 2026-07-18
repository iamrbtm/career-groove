import { Dashboard } from "@/components/dashboard";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin?callbackUrl=/dashboard");
  return <Dashboard />;
}
