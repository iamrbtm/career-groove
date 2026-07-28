"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell, PageHeading } from "@/components/app-shell";
import { MotionButton } from "@/components/motion-button";
import { TrackerShell } from "./tracker-shell";
import { RoleList } from "./role-list";
import { CanvasWorkspace, CanvasEmptyState } from "./canvas-workspace";
import { CanvasHeader } from "./canvas-header";
import { StepAccordion } from "./step-accordion";
import { StepCard } from "./step-card";
import { ResearchStep } from "./steps/research-step";
import { DocumentsStep } from "./steps/documents-step";
import { FollowUpStep } from "./steps/followup-step";
import { InterviewStep } from "./steps/interview-step";
import { DecisionStep } from "./steps/decision-step";
import { ClosedStep } from "./steps/closed-step";
import { PipelineSignals } from "./pipeline-signals";
import { CaptureModal } from "./capture-modal";

type Application = {
  id: string; status: string; title: string; company: string;
  location: string | null; workMode: string | null;
  salaryMin: number | null; salaryMax: number | null;
  salaryCurrency: string; sourceUrl: string | null;
  source: string | null; description: string; notes: string | null;
  priorityLabel: string | null; nextActionType: string | null;
  nextActionReason: string | null; followUpDueAt: string | null;
  appliedAt: string | null; archivedAt: string | null;
  currentStep?: number | null;
  metadata: Record<string, unknown>;
  createdAt: string; updatedAt: string;
  latestScore?: { id?: string; label: string; fit?: number; readiness?: number; desire?: number; leverage?: number; risk?: number; timing?: number; reasons: string[]; gaps: string[]; nextAction: string; createdAt?: string } | null;
};

type ApplicationEvent = { id: string; eventType: string; title: string; body: string | null; occurredAt: string; createdAt: string };
type ApplicationDocument = { id: string; kind: string; title: string | null; status: string; submittedAt: string | null; createdAt: string };
type ApplicationContact = { id: string; name: string; company: string | null; role: string | null; email: string | null };
type ApplicationInterview = { id: string; roundType: string; scheduledAt: string | null; interviewer: string | null; meetingLink: string | null; prepStatus: string };
type ApplicationOutcome = { id: string; outcome: string; stage: string | null; reason: string | null; userNote: string | null; source: string | null; roleFit?: string; similarStrategy?: string; occurredAt: string };
type DocumentJob = { id: string; kind: string; status: string; createdAt: string };
type TrackerReadiness = { score: number; ready: boolean; headline: string; message: string; checklist: Array<{ label: string; done: boolean }> };
type Analytics = { summary: { total: number; savedThisWeek: number; submittedCount: number; followUpsDue: number; interviewsActive: number; offersActive: number; responseRate: number; interviewRate: number; followUpHealth?: number }; sourceHealth?: Array<{ source: string; total: number; responses: number; responseRate: number }>; resumePerformance?: Array<{ version: string; outcomes: number; positive: number; positiveRate: number }>; labels?: Array<{ label: string; count: number }>; roleFitTrends?: Array<{ roleFit: string; similarStrategy: string; count: number }> };
type InsightResponse = { lowData: boolean; closedCount: number; insights: Array<{ id: string; kind: string; title: string; copy: string; suggestion: string; confidence: string; state: string }> };

const totalSteps = 6;

export function TrackerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [events, setEvents] = useState<ApplicationEvent[]>([]);
  const [documents, setDocuments] = useState<ApplicationDocument[]>([]);
  const [contacts, setContacts] = useState<ApplicationContact[]>([]);
  const [interviews, setInterviews] = useState<ApplicationInterview[]>([]);
  const [outcomes, setOutcomes] = useState<ApplicationOutcome[]>([]);
  const [trackerReadiness, setTrackerReadiness] = useState<TrackerReadiness | null>(null);
  const [documentJobs, setDocumentJobs] = useState<DocumentJob[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [insights, setInsights] = useState<InsightResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [activeStep, setActiveStepState] = useState<number | null>(null);

  const selected = useMemo(() => applications.find((a) => a.id === selectedId), [applications, selectedId]);
  const currentStep = useMemo(() => {
    if (!selected) return 1;
    if (selected.currentStep != null) return selected.currentStep;
    const map: Record<string, number> = { saved: 1, researching: 1, ready_to_apply: 2, applied: 3, follow_up: 3, interviewing: 4, offer: 5, rejected: 6, withdrawn: 6, archived: 6 };
    return map[selected.status] ?? 1;
  }, [selected]);
  useEffect(() => {
    if (activeStep === null && selected) setActiveStepState(currentStep);
  }, [selected?.id, currentStep, activeStep]);

  async function refreshApplications(preferredId?: string) {
    setError("");
    const res = await fetch("/api/applications", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setApplications(data.applications || []);
    setTrackerReadiness(data.trackerReadiness || null);
    const targetId = preferredId || searchParams.get("applicationId") || selectedId;
    if (targetId && data.applications?.some((a: Application) => a.id === targetId)) setSelectedId(targetId);
    else if (data.applications?.[0]) setSelectedId(data.applications[0].id);
    else setSelectedId("");
  }

  async function refreshSupportingData() {
    const [jobsRes, analyticsRes, prefsRes, insightsRes] = await Promise.all([
      fetch("/api/document-jobs", { cache: "no-store" }),
      fetch("/api/application-analytics", { cache: "no-store" }),
      fetch("/api/application-preferences", { cache: "no-store" }),
      fetch("/api/application-insights", { cache: "no-store" }),
    ]);
    if (jobsRes.ok) setDocumentJobs((await jobsRes.json()).jobs || []);
    if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
    if (insightsRes.ok) setInsights(await insightsRes.json());
  }

  async function loadDetail(applicationId: string) {
    const res = await fetch(`/api/applications/${applicationId}`, { cache: "no-store" });
    if (!res.ok) { setEvents([]); setDocuments([]); setContacts([]); setInterviews([]); setOutcomes([]); return; }
    const data = await res.json();
    setEvents(data.events || []);
    setDocuments(data.documents || []);
    setContacts(data.contacts || []);
    setInterviews(data.interviews || []);
    setOutcomes(data.outcomes || []);
    if (data.application) setApplications((prev) => prev.map((a) => a.id === data.application.id ? { ...a, ...data.application } : a));
  }

  const refreshAll = useCallback(async (preferredId?: string) => {
    await Promise.all([refreshApplications(preferredId), refreshSupportingData()]);
  }, []);

  useEffect(() => {
    Promise.all([refreshApplications(), refreshSupportingData()])
      .catch(() => setError("Could not load applications."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const targetId = searchParams.get("applicationId");
    if (targetId && applications.some((a) => a.id === targetId)) setSelectedId(targetId);
  }, [applications, searchParams]);

  useEffect(() => {
    if (!selected?.id) { setEvents([]); setDocuments([]); setContacts([]); setInterviews([]); setOutcomes([]); return; }
    void loadDetail(selected.id);
  }, [selected?.id]);

  function handleSelect(id: string) {
    setSelectedId(id);
    setActiveStepState(null);
    router.replace(`/applications?applicationId=${id}`);
  }

  function handleSaved() {
    void refreshAll();
  }

  function toggleStep(step: number) {
    setActiveStepState((prev) => prev === step ? null : step);
  }

  async function advanceStep() {
    if (!selected) return;
    const nextStep = Math.min(currentStep + 1, totalSteps);
    await fetch(`/api/applications/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: nextStep }),
    });
    setActiveStepState(nextStep);
    await refreshAll(selected.id);
    await loadDetail(selected.id);
  }

  async function handleArchive() {
    if (!selected) return;
    await fetch(`/api/applications/${selected.id}`, { method: "DELETE" });
    await refreshAll();
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-4">
        <PageHeading
          eyebrow="Tracker Studio"
          title="Applications"
          copy="Capture roles, keep the next move visible. Each application shows its current step — pick up where you left off."
        />
        <MotionButton
          onClick={() => setCaptureOpen(true)}
          className="flex shrink-0 items-center gap-2 rounded-2xl border-2 border-ink bg-coral px-4 py-3 text-sm font-black shadow-pop"
        >
          <Plus size={18} /> Capture Role
        </MotionButton>
      </div>

      {error && <p className="mt-5 rounded-2xl border-2 border-coral bg-coral/15 p-3 text-sm font-black">{error}</p>}

      <TrackerShell
        roleList={
          <RoleList
            applications={applications}
            selectedId={selectedId}
            onSelect={handleSelect}
            onRefresh={() => refreshAll(selected?.id)}
            loading={loading}
            trackerReadiness={trackerReadiness}
          />
        }
        canvas={
          selected ? (
            <CanvasWorkspace>
              <CanvasHeader
                title={selected.title}
                company={selected.company}
                currentStep={currentStep}
                totalSteps={totalSteps}
                readinessReady={trackerReadiness?.ready ?? false}
                latestScore={selected.latestScore}
              />
              <StepAccordion>
                {stepConfigs(currentStep, currentStep).map(({ num, title, isComplete, isCurrent }) => (
                  <StepCard
                    key={num}
                    stepNumber={num}
                    title={title}
                    isComplete={isComplete}
                    isCurrent={isCurrent}
                    isExpanded={activeStep === num}
                    onToggle={() => toggleStep(num)}
                  >
                    {num === 1 && (
                      <ResearchStep
                        applicationId={selected.id}
                        metadata={selected.metadata}
                        sourceUrl={selected.sourceUrl}
                        onAdvance={advanceStep}
                      />
                    )}
                    {num === 2 && (
                      <DocumentsStep
                        applicationId={selected.id}
                        score={selected.latestScore}
                        documents={documents}
                        documentJobs={documentJobs}
                        onRefresh={() => loadDetail(selected.id)}
                        onAdvance={advanceStep}
                      />
                    )}
                    {num === 3 && (
                      <FollowUpStep
                        applicationId={selected.id}
                        followUpDueAt={selected.followUpDueAt}
                        applicationTitle={selected.title}
                        applicationCompany={selected.company}
                        onRefresh={() => loadDetail(selected.id)}
                      />
                    )}
                    {num === 4 && (
                      <InterviewStep
                        applicationId={selected.id}
                        interviews={interviews}
                        onRefresh={() => loadDetail(selected.id)}
                      />
                    )}
                    {num === 5 && (
                      <DecisionStep
                        applicationId={selected.id}
                        metadata={selected.metadata}
                        status={selected.status}
                        onRefresh={() => loadDetail(selected.id)}
                      />
                    )}
                    {num === 6 && (
                      <ClosedStep
                        applicationId={selected.id}
                        status={selected.status}
                        outcomes={outcomes}
                        insights={insights}
                        onRefresh={() => loadDetail(selected.id)}
                        onArchive={handleArchive}
                      />
                    )}
                  </StepCard>
                ))}
              </StepAccordion>
              <PipelineSignals analytics={analytics} />
            </CanvasWorkspace>
          ) : (
            <CanvasEmptyState />
          )
        }
      />

      <CaptureModal
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onSaved={handleSaved}
      />
    </AppShell>
  );
}

function stepConfigs(currentStep: number, _totalSteps: number) {
  return [
    { num: 1, title: "Research", isComplete: currentStep > 1, isCurrent: currentStep === 1 },
    { num: 2, title: "Documents", isComplete: currentStep > 2, isCurrent: currentStep === 2 },
    { num: 3, title: "Follow-up", isComplete: currentStep > 3, isCurrent: currentStep === 3 },
    { num: 4, title: "Interview", isComplete: currentStep > 4, isCurrent: currentStep === 4 },
    { num: 5, title: "Decision", isComplete: currentStep > 5, isCurrent: currentStep === 5 },
    { num: 6, title: "Closed", isComplete: currentStep > 6, isCurrent: currentStep === 6 },
  ];
}
