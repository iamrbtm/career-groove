import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserTier } from "@/lib/api-auth";
import { JobInterviewer } from "@/components/job-interviewer";

export default async function InterviewPage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/interview");
  const tier = await getUserTier(session.user.id);
  if (tier === "free") redirect("/dashboard?want=pro");
  const { jobId } = await searchParams;
  return <JobInterviewer jobId={jobId} />;
}
