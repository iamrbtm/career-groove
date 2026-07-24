import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ApplicationTracker } from "@/components/application-tracker";

export default async function ApplicationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin?callbackUrl=/applications");
  return <ApplicationTracker />;
}
