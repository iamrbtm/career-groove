export interface AITask {
  id: string;
  label: string;
  description: string;
}

export const AI_TASKS: AITask[] = [
  { id: "job-interviewer", label: "Career chapter → bullets + skills", description: "Extract achievements and skills from work history" },
  { id: "job-interview-probe", label: "Adaptive follow-up questions", description: "Ask clarifying career-history questions" },
  { id: "mock-interview", label: "Reverse mock interview", description: "Challenging but supportive practice interviews" },
  { id: "resume", label: "Resume generation", description: "Create ATS-friendly resume content" },
  { id: "cover-letter", label: "Cover letter generation", description: "Write specific, human cover letters" },
  { id: "application-answers", label: "Application screening answers", description: "Answer job application screening questions" },
  { id: "outreach-draft", label: "Outreach note drafting", description: "Draft recruiter/referral outreach notes" },
  { id: "soundcheck-brief", label: "Interview prep brief", description: "Create role-specific interview preparation briefs" },
  { id: "document-resume", label: "Document generation — resume", description: "Background resume generation in the documents tab" },
  { id: "document-cover-letter", label: "Document generation — cover letter", description: "Background cover letter generation in the documents tab" },
  { id: "chapter-reprocess", label: "Chapter reprocessing", description: "Re-rewrite a raw career chapter into polished narrative" },
  { id: "application-score", label: "Career DJ scoring", description: "AI-powered job opportunity scoring" },
];

export const AI_TASK_IDS = AI_TASKS.map((task) => task.id) as [string, ...string[]];
