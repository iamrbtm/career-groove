import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AnalyticsStudio } from "@/components/analytics-studio";

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin?callbackUrl=/analytics");
  return <AnalyticsStudio />;
}
