import { Suspense } from "react";
import { MockInterviewer } from "@/components/mock-interviewer";

export default function MockInterviewPage() {
  return <Suspense fallback={null}><MockInterviewer /></Suspense>;
}
