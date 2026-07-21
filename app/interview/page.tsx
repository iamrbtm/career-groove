import { JobInterviewer } from "@/components/job-interviewer";
export default async function InterviewPage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string }>;
}) {
  const { jobId } = await searchParams;
  return <JobInterviewer jobId={jobId} />;
}
