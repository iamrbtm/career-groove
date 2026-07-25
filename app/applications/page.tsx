import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TrackerPage } from "@/components/tracker/tracker-page";

export default async function ApplicationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin?callbackUrl=/applications");
  return <TrackerPage />;
}
