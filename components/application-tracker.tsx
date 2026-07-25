"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  ClipboardList,
  Clock3,
  ExternalLink,
  FileText,
  LoaderCircle,
  Music4,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Tags,
  UserRoundPlus,
} from "lucide-react";

import { AppShell, PageHeading } from "./app-shell";
import { MotionButton } from "./motion-button";
import { applicationStatuses, statusLabels } from "@/lib/application-schema";

type Score = {
  id?: string;
  label: string;
  fit?: number;
  readiness?: number;
  desire?: number;
  leverage?: number;
  risk?: number;
  timing?: number;
  reasons: string[];
  gaps: string[];
  nextAction: string;
  createdAt?: string;
};

type Application = {
  id: string;
  status: string;
  title: string;
  company: string;
  location: string | null;
  workMode: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  sourceUrl: string | null;
  source: string | null;
  description: string;
  notes: string | null;
  priorityLabel: string | null;
  nextActionType: string | null;
  nextActionReason: string | null;
  followUpDueAt: string | null;
  appliedAt: string | null;
  archivedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  latestScore?: Score | null;
};

type ApplicationEvent = {
  id: string;
  eventType: string;
  title: string;
  body: string | null;
  occurredAt: string;
  createdAt: string;
};

type ApplicationDocument = {
  id: string;
  documentGenerationJobId?: string | null;
  documentId?: string | null;
  kind: "resume" | "cover_letter" | "other";
  title: string | null;
  status: string;
  submittedAt: string | null;
  createdAt: string;
};

type ApplicationContact = {
  id: string;
  name: string;
  company: string | null;
  role: string | null;
  email: string | null;
  relationship?: string | null;
};

type ApplicationInterview = {
  id: string;
  roundType: string;
  scheduledAt: string | null;
  interviewer: string | null;
  meetingLink?: string | null;
  prepStatus: string;
};

type ApplicationOutcome = {
  id: string;
  outcome: string;
  stage: string | null;
  reason: string | null;
  userNote: string | null;
  source?: string | null;
  contactUsed?: boolean | null;
  resumeDocumentId?: string | null;
  coverLetterDocumentId?: string | null;
  occurredAt: string;
  offer?: Record<string, unknown>;
};

type NetworkContact = {
  id: string;
  name: string;
  company?: string | null;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  relationshipStrength?: number;
};

type DocumentJob = {
  id: string;
  kind: "resume" | "cover_letter" | "both";
  targetJob: { title: string; company: string; description: string };
  status: "queued" | "processing" | "completed" | "failed";
  createdAt: string;
};

type Analytics = {
  summary: {
    total: number;
    savedThisWeek: number;
    submittedCount: number;
    followUpsDue: number;
    interviewsActive: number;
    offersActive: number;
    rejectionsLogged: number;
    responseRate: number;
    interviewRate: number;
    followUpsScheduled?: number;
    followUpHealth?: number;
  };
  sources: Array<{ source: string; count: number }>;
  labels: Array<{ label: string; count: number }>;
  sourceHealth?: Array<{ source: string; total: number; responses: number; offers: number; responseRate: number }>;
  resumePerformance?: Array<{ version: string; outcomes: number; positive: number; closed: number; positiveRate: number }>;
  roleFitTrends?: Array<{ roleFit: string; similarStrategy: string; count: number }>;
  outcomes?: Array<{ outcome: string; count: number }>;
};

type JobPreferences = {
  desiredTitles: string[];
  workModes: string[];
  salaryTarget: number | null;
  locationPreference: string | null;
  industries: string[];
  values: string[];
  redFlags: string[];
  weeklyPace: number | null;
  defaultFollowUpDays: number;
};

type TrackerReadiness = {
  score: number;
  ready: boolean;
  headline: string;
  message: string;
  checklist: Array<{ label: string; done: boolean }>;
};

type CommandSessionAction = {
  id: string;
  applicationId: string | null;
  actionType: string;
  title: string;
  reason: string;
  routeTarget: string;
  status: "pending" | "completed" | "skipped" | "snoozed";
  skipReason: string | null;
};

type CommandSession = {
  id: string;
  mode: "light" | "standard" | "deep" | "recovery" | "interview";
  status: "active" | "finished" | "archived";
  title: string;
  recap?: { intro?: string };
  actions: CommandSessionAction[];
};

type ApplicationInsight = {
  id: string;
  kind: string;
  title: string;
  copy: string;
  evidence: string[];
  suggestion: string;
  confidence: "low" | "medium" | "high";
  state: "active" | "dismissed" | "later";
};

type InsightResponse = {
  lowData: boolean;
  closedCount: number;
  insights: ApplicationInsight[];
};

const statusOptions = applicationStatuses.filter((status) => status !== "archived");
const labelText: Record<string, string> = {
  apply_first: "Apply First",
  research_before_applying: "Research Before Applying",
  remix_resume_first: "Remix Resume First",
  network_first: "Network First",
  stretch_role: "Stretch Role",
  low_signal_lead: "Low-Signal Lead",
  probably_skip: "Probably Skip",
  follow_up_now: "Follow-Up Now",
  prep_mode: "Prep Mode",
};
const sessionModes: Array<{ value: CommandSession["mode"]; label: string }> = [
  { value: "light", label: "Light" },
  { value: "standard", label: "Standard" },
  { value: "deep", label: "Deep" },
  { value: "recovery", label: "Recovery" },
  { value: "interview", label: "Interview" },
];

function formatDate(value: string | null, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", options).format(new Date(value));
}

function friendlyAction(application: Application) {
  if (application.latestScore?.nextAction) return actionCopy(application.latestScore.nextAction, application.nextActionReason ?? undefined);
  if (application.nextActionReason) return application.nextActionReason;
  if (application.status === "applied" || application.status === "follow_up") return "Check whether a follow-up is due.";
  if (application.status === "interviewing") return "Prep with this role context.";
  if (application.status === "offer") return "Compare the offer against what matters.";
  if (application.status === "rejected") return "Log what happened when you have the energy.";
  return "Decide whether this role deserves document time.";
}

function actionCopy(action: string | null | undefined, fallback = "Choose the next best move.") {
  switch (action) {
    case "apply":
      return "This role looks worth attention now.";
    case "research_company":
      return "Learn one concrete thing before spending document energy.";
    case "remix_resume":
      return "Tune your story toward this role before you submit.";
    case "contact_referral":
      return "A person may improve the odds here.";
    case "follow_up":
      return "The timing is right for a concise follow-up.";
    case "prep_interview":
      return "Use this role for focused prep and follow-through.";
    case "compare_offer":
      return "This moment needs decision clarity, not more noise.";
    default:
      return fallback;
  }
}

function scoreBadgeValue(value: number | undefined) {
  if (typeof value !== "number") return "Not scored";
  return `${value}/100`;
}

export function ApplicationTracker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [events, setEvents] = useState<ApplicationEvent[]>([]);
  const [documents, setDocuments] = useState<ApplicationDocument[]>([]);
  const [contacts, setContacts] = useState<ApplicationContact[]>([]);
  const [interviews, setInterviews] = useState<ApplicationInterview[]>([]);
  const [outcomes, setOutcomes] = useState<ApplicationOutcome[]>([]);
  const [trackerReadiness, setTrackerReadiness] = useState<TrackerReadiness | null>(null);
  const [session, setSession] = useState<CommandSession | null>(null);
  const [documentJobs, setDocumentJobs] = useState<DocumentJob[]>([]);
  const [contactLibrary, setContactLibrary] = useState<NetworkContact[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [preferences, setPreferences] = useState<JobPreferences | null>(null);
  const [insights, setInsights] = useState<InsightResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [importCsv, setImportCsv] = useState("");
  const [importNotice, setImportNotice] = useState("");
  const [capture, setCapture] = useState({
    title: "",
    company: "",
    location: "",
    workMode: "unknown",
    salaryMin: "",
    salaryMax: "",
    sourceUrl: "",
    description: "",
    notes: "",
  });
  const [parseNotice, setParseNotice] = useState("");

  const selected = useMemo(() => applications.find((item) => item.id === selectedId) || applications[0], [applications, selectedId]);

  async function refreshApplications(preferredId?: string) {
    setError("");
    const response = await fetch("/api/applications", { cache: "no-store" });
    if (!response.ok) throw new Error("Applications could not be loaded.");
    const data = await response.json();
    setApplications(data.applications || []);
    setTrackerReadiness(data.trackerReadiness || null);
    const targetId = preferredId || searchParams.get("applicationId") || selectedId;
    if (targetId && data.applications?.some((item: Application) => item.id === targetId)) {
      setSelectedId(targetId);
    } else if (data.applications?.[0]) {
      setSelectedId(data.applications[0].id);
    } else {
      setSelectedId("");
    }
  }

  async function refreshSession() {
    const response = await fetch("/api/command-sessions", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setSession(data.session || null);
    if (data.trackerReadiness) setTrackerReadiness(data.trackerReadiness);
  }

  async function refreshSupportingData() {
    const [jobsResponse, analyticsResponse, preferencesResponse, insightsResponse, contactsResponse] = await Promise.all([
      fetch("/api/document-jobs", { cache: "no-store" }),
      fetch("/api/application-analytics", { cache: "no-store" }),
      fetch("/api/application-preferences", { cache: "no-store" }),
      fetch("/api/application-insights", { cache: "no-store" }),
      fetch("/api/contacts", { cache: "no-store" }),
    ]);
    if (jobsResponse.ok) {
      const data = await jobsResponse.json();
      setDocumentJobs(data.jobs || []);
    }
    if (analyticsResponse.ok) {
      const data = await analyticsResponse.json();
      setAnalytics(data);
    }
    if (preferencesResponse.ok) {
      const data = await preferencesResponse.json();
      setPreferences(data.preferences || null);
    }
    if (insightsResponse.ok) {
      const data = await insightsResponse.json();
      setInsights(data || null);
    }
    if (contactsResponse.ok) {
      const data = await contactsResponse.json();
      setContactLibrary(data.contacts || []);
    }
  }

  async function updateInsight(insightId: string, action: "dismissed" | "later" | "active") {
    const response = await fetch("/api/application-insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ insightId, action }),
    });
    if (!response.ok) return;
    await refreshSupportingData();
  }

  async function loadDetail(applicationId: string) {
    const response = await fetch(`/api/applications/${applicationId}`, { cache: "no-store" });
    if (!response.ok) {
      setEvents([]);
      setDocuments([]);
      setContacts([]);
      setInterviews([]);
      setOutcomes([]);
      return;
    }
    const data = await response.json();
    setEvents(data.events || []);
    setDocuments(data.documents || []);
    setContacts(data.contacts || []);
    setInterviews(data.interviews || []);
    setOutcomes(data.outcomes || []);
    if (data.application) {
      setApplications((current) => current.map((item) => item.id === data.application.id ? { ...item, ...data.application } : item));
    }
  }

  useEffect(() => {
    Promise.all([refreshApplications(), refreshSession(), refreshSupportingData()])
      .catch((err) => setError(err instanceof Error ? err.message : "Applications could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const targetId = searchParams.get("applicationId");
    if (targetId && applications.some((item) => item.id === targetId)) setSelectedId(targetId);
  }, [applications, searchParams]);

  useEffect(() => {
    if (!selected?.id) {
      setEvents([]);
      setDocuments([]);
      setContacts([]);
      setInterviews([]);
      setOutcomes([]);
      return;
    }
    void loadDetail(selected.id);
  }, [selected?.id]);

  async function createApplication(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...capture,
          salaryMin: capture.salaryMin ? Number(capture.salaryMin) : null,
          salaryMax: capture.salaryMax ? Number(capture.salaryMax) : null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("Save failed. Check the required fields.");
      setCapture({ title: "", company: "", location: "", workMode: "unknown", salaryMin: "", salaryMax: "", sourceUrl: "", description: "", notes: "" });
      await Promise.all([refreshApplications(data.application.id), refreshSession()]);
      setSelectedId(data.application.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function parseCapture() {
    if (!capture.description.trim()) {
      setParseNotice("Paste a job description first.");
      return;
    }
    setParsing(true);
    setParseNotice("");
    try {
      const response = await fetch("/api/applications/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: capture.description,
          sourceUrl: capture.sourceUrl || "",
          fallbackTitle: capture.title,
          fallbackCompany: capture.company,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("CareerGroove could not parse that posting.");
      const parsed = data.parsed || {};
      setCapture((current) => ({
        ...current,
        title: current.title || parsed.title || "",
        company: current.company || parsed.company || "",
        location: current.location || parsed.location || "",
        workMode: parsed.workMode || current.workMode,
        salaryMin: current.salaryMin || (parsed.salaryMin ? String(parsed.salaryMin) : ""),
        salaryMax: current.salaryMax || (parsed.salaryMax ? String(parsed.salaryMax) : ""),
        sourceUrl: current.sourceUrl || parsed.sourceUrl || "",
        notes: [
          current.notes,
          parsed.summary ? `Summary: ${parsed.summary}` : "",
          parsed.mustHaveSkills?.length ? `Must-have skills: ${parsed.mustHaveSkills.join(", ")}` : "",
          parsed.niceToHaveSkills?.length ? `Nice-to-have skills: ${parsed.niceToHaveSkills.join(", ")}` : "",
          parsed.redFlags?.length ? `Watch-outs: ${parsed.redFlags.join(", ")}` : "",
          parsed.deadline ? `Deadline: ${parsed.deadline}` : "",
        ].filter(Boolean).join("\n"),
      }));
      setParseNotice(`Parsed with ${parsed.confidence || "medium"} confidence. Review before saving.`);
    } catch (err) {
      setParseNotice(err instanceof Error ? err.message : "CareerGroove could not parse that posting.");
    } finally {
      setParsing(false);
    }
  }

  async function updateStatus(status: string) {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/applications/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Status update failed.");
      await Promise.all([refreshApplications(selected.id), loadDetail(selected.id), refreshSession()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveSelected() {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/applications/${selected.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Archive failed.");
      setSelectedId("");
      await Promise.all([refreshApplications(), refreshSession()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed.");
    } finally {
      setSaving(false);
    }
  }

  async function addNote(event: FormEvent) {
    event.preventDefault();
    if (!selected || !note.trim()) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/applications/${selected.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType: "note_added", title: "Note added", body: note }),
      });
      if (!response.ok) throw new Error("Note could not be saved.");
      setNote("");
      await Promise.all([loadDetail(selected.id), refreshSession()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Note could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function rescoreSelected() {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/applications/${selected.id}/score?ai=true`, { method: "POST" });
      if (!response.ok) throw new Error("Career DJ could not refresh this role.");
      await Promise.all([refreshApplications(selected.id), loadDetail(selected.id), refreshSession()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Career DJ could not refresh this role.");
    } finally {
      setSaving(false);
    }
  }

  async function startSession(mode: CommandSession["mode"]) {
    setSessionLoading(true);
    setError("");
    try {
      const response = await fetch("/api/command-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, refresh: true }),
      });
      if (!response.ok) throw new Error("Today's mix could not be generated.");
      const data = await response.json();
      setSession(data.session || null);
      if (data.trackerReadiness) setTrackerReadiness(data.trackerReadiness);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Today's mix could not be generated.");
    } finally {
      setSessionLoading(false);
    }
  }

  async function exportApplications() {
    const response = await fetch("/api/applications/export");
    if (!response.ok) throw new Error("Export failed.");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `career-groove-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importApplications(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setImportNotice("");
    try {
      const response = await fetch("/api/applications/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: importCsv }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Import failed.");
      setImportNotice(`Imported ${data.imported} application${data.imported === 1 ? "" : "s"}.`);
      setImportCsv("");
      await Promise.all([refreshApplications(), refreshSupportingData(), refreshSession()]);
    } catch (err) {
      setImportNotice(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setSaving(false);
    }
  }

  async function updateSessionAction(actionId: string, status: "completed" | "skipped" | "snoozed") {
    if (!session) return;
    setSessionLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/command-sessions/${session.id}/actions/${actionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("That action could not be updated.");
      await Promise.all([refreshSession(), refreshApplications(selected?.id)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That action could not be updated.");
    } finally {
      setSessionLoading(false);
    }
  }

  return <AppShell>
    <PageHeading
      eyebrow="Tracker Studio"
      title="Applications"
      copy="Capture roles, keep the next move visible, and let the detailed pipeline sit behind a calmer guided workflow."
      action={<MotionButton onClick={() => document.getElementById("quick-capture-title")?.focus()} className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-coral px-4 py-3 text-sm font-black shadow-pop"><Plus size={18} /> Paste a job</MotionButton>}
    />

    {error && <p className="mt-5 rounded-2xl border-2 border-coral bg-coral/15 p-3 text-sm font-black">{error}</p>}

    <section className="mt-7 grid gap-5 xl:grid-cols-[400px_1fr]">
      <div className="space-y-5">
        <TrackerReadinessCard readiness={trackerReadiness} />
        <CommandSessionCard session={session} sessionLoading={sessionLoading} startSession={startSession} updateSessionAction={updateSessionAction} applications={applications} />
        <TrackerOpsCard analytics={analytics} importCsv={importCsv} setImportCsv={setImportCsv} importApplications={importApplications} importNotice={importNotice} exportApplications={exportApplications} saving={saving} />

        <form onSubmit={createApplication} className="rounded-3xl border-2 border-ink bg-white p-5 shadow-[0_5px_0_#26312c]">
          <div className="flex items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl border-2 border-ink bg-mint"><ClipboardList size={20} /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-plum">Quick Capture</p>
              <h2 className="font-[var(--font-display)] text-xl font-black">Paste the lead</h2>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            <input id="quick-capture-title" value={capture.title} onChange={(event) => setCapture({ ...capture, title: event.target.value })} placeholder="Role title" className="rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
            <input value={capture.company} onChange={(event) => setCapture({ ...capture, company: event.target.value })} placeholder="Company" className="rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={capture.location} onChange={(event) => setCapture({ ...capture, location: event.target.value })} placeholder="Location" className="rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
              <select value={capture.workMode} onChange={(event) => setCapture({ ...capture, workMode: event.target.value })} className="rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none">
                <option value="unknown">Work mode</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">Onsite</option>
                <option value="flexible">Flexible</option>
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input inputMode="numeric" value={capture.salaryMin} onChange={(event) => setCapture({ ...capture, salaryMin: event.target.value })} placeholder="Salary min" className="rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
              <input inputMode="numeric" value={capture.salaryMax} onChange={(event) => setCapture({ ...capture, salaryMax: event.target.value })} placeholder="Salary max" className="rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
            </div>
            <input value={capture.sourceUrl} onChange={(event) => setCapture({ ...capture, sourceUrl: event.target.value })} placeholder="Source URL" className="rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
            <textarea required value={capture.description} onChange={(event) => setCapture({ ...capture, description: event.target.value })} placeholder="Job description" className="min-h-36 resize-y rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
            <button type="button" onClick={() => void parseCapture()} disabled={parsing || !capture.description.trim()} className="flex items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-white px-4 py-3 text-sm font-black disabled:opacity-60">{parsing ? <LoaderCircle size={17} className="animate-spin" /> : <Tags size={17} />} Parse posting</button>
            {parseNotice && <p className="rounded-2xl bg-mint/20 p-3 text-sm font-bold text-ink/70">{parseNotice}</p>}
            <textarea value={capture.notes} onChange={(event) => setCapture({ ...capture, notes: event.target.value })} placeholder="Private notes" className="min-h-20 resize-y rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
            <button disabled={saving} className="flex items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-sun px-4 py-3 text-sm font-black shadow-[0_3px_0_#26312c] disabled:opacity-60">{saving ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={17} />} Save opportunity</button>
          </div>
        </form>

        <div className="rounded-3xl border-2 border-ink/15 bg-white/70 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-[var(--font-display)] text-xl font-black">Saved roles</h2>
            <button onClick={() => void Promise.all([refreshApplications(selected?.id), refreshSession()]).catch(() => undefined)} className="grid size-10 place-items-center rounded-2xl bg-cream" title="Refresh"><RefreshCw size={17} /></button>
          </div>
          <div className="mt-4 space-y-3">
            {loading && <p className="rounded-2xl bg-cream p-4 text-sm font-bold text-ink/55">Loading applications...</p>}
            {!loading && !applications.length && <div className="rounded-3xl border-2 border-dashed border-ink/20 bg-cream/70 p-5 text-center">
              <Sparkles className="mx-auto text-coral" />
              <p className="mt-3 font-black">No applications yet.</p>
              <p className="mt-1 text-sm text-ink/55">Paste a job description and Career DJ will turn it into a clearer next move.</p>
            </div>}
            {applications.map((application) => <button key={application.id} onClick={() => {
              setSelectedId(application.id);
              router.replace(`/applications?applicationId=${application.id}`);
            }} className={`w-full rounded-2xl border-2 p-4 text-left transition ${selected?.id === application.id ? "border-ink bg-mint/30" : "border-ink/10 bg-white hover:border-ink/40"}`}>
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-plum text-white"><BriefcaseBusiness size={18} /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black">{application.title}</p>
                  <p className="truncate text-sm text-ink/55">{application.company}</p>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-ink/55">{friendlyAction(application)}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black">
                <span className="rounded-full bg-cream px-3 py-1">{statusLabels[application.status as keyof typeof statusLabels]}</span>
                <span className="rounded-full bg-sun/70 px-3 py-1">{labelText[application.priorityLabel || ""] || "Needs review"}</span>
                {application.followUpDueAt && <span className="rounded-full bg-coral/20 px-3 py-1">Follow-up {formatDate(application.followUpDueAt)}</span>}
              </div>
            </button>)}
          </div>
        </div>
      </div>

      <ApplicationWorkspace
        application={selected}
        events={events}
        documents={documents}
        contacts={contacts}
        interviews={interviews}
        outcomes={outcomes}
        documentJobs={documentJobs}
        contactLibrary={contactLibrary}
        preferences={preferences}
        insights={insights}
        updateInsight={updateInsight}
        refreshDetail={async () => {
          if (selected?.id) await loadDetail(selected.id);
          await refreshSupportingData();
          await refreshApplications(selected?.id);
        }}
        note={note}
        setNote={setNote}
        addNote={addNote}
        updateStatus={updateStatus}
        archiveSelected={archiveSelected}
        saving={saving}
        rescoreSelected={rescoreSelected}
      />
    </section>
  </AppShell>;
}

function TrackerReadinessCard({ readiness }: { readiness: TrackerReadiness | null }) {
  if (!readiness) return null;
  return <section className={`rounded-3xl border-2 p-5 ${readiness.ready ? "border-mint bg-mint/25" : "border-coral bg-coral/10"}`}>
    <div className="flex items-start gap-3">
      <div className="grid size-12 shrink-0 place-items-center rounded-2xl border-2 border-ink bg-white"><Sparkles size={20} /></div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-plum">Tracker readiness</p>
        <h2 className="mt-1 font-[var(--font-display)] text-xl font-black">{readiness.headline}</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">{readiness.message}</p>
      </div>
    </div>
    <div className="mt-4 flex items-center gap-3">
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/80">
        <div className="h-full rounded-full bg-plum" style={{ width: `${readiness.score}%` }} />
      </div>
      <span className="text-sm font-black">{readiness.score}%</span>
    </div>
    <div className="mt-4 grid gap-2">
      {readiness.checklist.map((item) => <div key={item.label} className="flex items-center gap-3 rounded-2xl bg-white/80 px-3 py-2 text-sm font-bold">
        <span className={`grid size-6 place-items-center rounded-full border-2 border-ink ${item.done ? "bg-mint" : "bg-white"}`}>{item.done && <Check size={14} />}</span>
        <span>{item.label}</span>
      </div>)}
    </div>
  </section>;
}

function TrackerOpsCard({
  analytics,
  importCsv,
  setImportCsv,
  importApplications,
  importNotice,
  exportApplications,
  saving,
}: {
  analytics: Analytics | null;
  importCsv: string;
  setImportCsv: (value: string) => void;
  importApplications: (event: FormEvent) => Promise<void>;
  importNotice: string;
  exportApplications: () => Promise<void>;
  saving: boolean;
}) {
  return <section className="rounded-3xl border-2 border-ink/15 bg-white/75 p-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-plum">Analytics</p>
        <h2 className="mt-1 font-[var(--font-display)] text-xl font-black">What is working?</h2>
      </div>
      <button onClick={() => void exportApplications()} className="rounded-full bg-sun px-3 py-1.5 text-xs font-black">Export CSV</button>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <ScoreTile label="Active roles" value={`${analytics?.summary.total ?? 0}`} />
      <ScoreTile label="Saved this week" value={`${analytics?.summary.savedThisWeek ?? 0}`} />
      <ScoreTile label="Response rate" value={`${analytics?.summary.responseRate ?? 0}%`} />
      <ScoreTile label="Interview rate" value={`${analytics?.summary.interviewRate ?? 0}%`} />
      <ScoreTile label="Follow-ups due" value={`${analytics?.summary.followUpsDue ?? 0}`} />
      <ScoreTile label="Follow-up health" value={`${analytics?.summary.followUpHealth ?? 0}%`} />
    </div>
    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      <div className="rounded-2xl bg-cream p-4">
        <p className="text-xs font-black uppercase tracking-[.18em] text-plum">Best sources</p>
        <div className="mt-3 space-y-2">
          {analytics?.sourceHealth?.length ? analytics.sourceHealth.slice(0, 3).map((source) => <p key={source.source} className="text-sm font-bold text-ink/70">{source.source} · {source.responseRate}% response · {source.total} roles</p>) : analytics?.sources?.length ? analytics.sources.slice(0, 3).map((source) => <p key={source.source} className="text-sm font-bold text-ink/70">{source.source} · {source.count}</p>) : <p className="text-sm font-bold text-ink/55">Once you save a few roles, source trends will show up here.</p>}
        </div>
      </div>
      <div className="rounded-2xl bg-cream p-4">
        <p className="text-xs font-black uppercase tracking-[.18em] text-plum">Priority labels</p>
        <div className="mt-3 space-y-2">
          {analytics?.labels?.length ? analytics.labels.slice(0, 4).map((label) => <p key={label.label} className="text-sm font-bold text-ink/70">{labelText[label.label] || titleCase(label.label.replaceAll("_", " "))} · {label.count}</p>) : <p className="text-sm font-bold text-ink/55">Career DJ labels will appear after a few saved roles.</p>}
        </div>
      </div>
      <div className="rounded-2xl bg-cream p-4">
        <p className="text-xs font-black uppercase tracking-[.18em] text-plum">Resume versions</p>
        <div className="mt-3 space-y-2">
          {analytics?.resumePerformance?.length ? analytics.resumePerformance.slice(0, 3).map((item) => <p key={item.version} className="text-sm font-bold text-ink/70">{item.version} · {item.positiveRate}% positive · {item.outcomes} outcomes</p>) : <p className="text-sm font-bold text-ink/55">Submitted-version trends appear after outcomes are linked to materials.</p>}
        </div>
      </div>
      <div className="rounded-2xl bg-cream p-4">
        <p className="text-xs font-black uppercase tracking-[.18em] text-plum">Role-fit trends</p>
        <div className="mt-3 space-y-2">
          {analytics?.roleFitTrends?.length ? analytics.roleFitTrends.slice(0, 3).map((item) => <p key={`${item.roleFit}-${item.similarStrategy}`} className="text-sm font-bold text-ink/70">{titleCase(item.roleFit)} · {item.similarStrategy.replace("_", " ")} · {item.count}</p>) : <p className="text-sm font-bold text-ink/55">Log fit reflections on outcomes to see targeting patterns.</p>}
        </div>
      </div>
    </div>
    <form onSubmit={importApplications} className="mt-4 rounded-2xl bg-cream p-4">
      <p className="text-xs font-black uppercase tracking-[.18em] text-plum">Import CSV</p>
      <textarea value={importCsv} onChange={(event) => setImportCsv(event.target.value)} placeholder="Paste spreadsheet CSV with at least title and company columns." className="mt-3 min-h-28 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none" />
      <button disabled={saving || !importCsv.trim()} className="mt-3 rounded-2xl border-2 border-ink bg-mint px-4 py-2.5 text-sm font-black disabled:opacity-60">Import applications</button>
      {importNotice && <p className="mt-3 text-sm font-bold text-ink/70">{importNotice}</p>}
    </form>
  </section>;
}

function CommandSessionCard({
  session,
  sessionLoading,
  startSession,
  updateSessionAction,
  applications,
}: {
  session: CommandSession | null;
  sessionLoading: boolean;
  startSession: (mode: CommandSession["mode"]) => Promise<void>;
  updateSessionAction: (actionId: string, status: "completed" | "skipped" | "snoozed") => Promise<void>;
  applications: Application[];
}) {
  const totalActions = session?.actions?.length ?? 0;
  const completedActions = session?.actions?.filter((action) => action.status !== "pending").length ?? 0;
  const activeAction = session?.actions?.find((action) => action.status === "pending") || session?.actions?.[0];
  const activeApplication = activeAction ? applications.find((item) => item.id === activeAction.applicationId) : null;
  return <section className="overflow-hidden rounded-3xl border-2 border-ink bg-ink p-5 text-cream shadow-soft">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-mint">Command Session</p>
        <h2 className="mt-1 font-[var(--font-display)] text-2xl font-black">{session?.title || "Today's Mix"}</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-cream/75">{session?.recap?.intro || "Build a short setlist from your pipeline, energy, and whatever is already due."}</p>
      </div>
      <Music4 className="shrink-0 text-sun" size={24} />
    </div>

    <div className="mt-4 flex flex-wrap gap-2">
      {sessionModes.map((mode) => <button key={mode.value} disabled={sessionLoading} onClick={() => void startSession(mode.value)} className={`rounded-full border px-3 py-1.5 text-xs font-black ${session?.mode === mode.value ? "border-sun bg-sun text-ink" : "border-cream/30 bg-cream/10 text-cream"}`}>
        {mode.label}
      </button>)}
    </div>

    <div className="mt-5 space-y-3">
      {sessionLoading && <div className="rounded-2xl bg-white/10 p-4 text-sm font-bold"><LoaderCircle className="inline animate-spin" size={16} /> Building your setlist...</div>}
      {!sessionLoading && !session?.actions?.length && <div className="rounded-2xl bg-white/10 p-4 text-sm font-bold">Start a session and CareerGroove will stack a few realistic next moves here.</div>}
      {activeAction && <div className="rounded-3xl border border-cream/20 bg-cream p-4 text-ink">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-plum">Now playing · {Math.min(completedActions + 1, totalActions)} of {totalActions}</p>
            <h3 className="mt-1 font-[var(--font-display)] text-xl font-black">{activeAction.title}</h3>
            {activeApplication && <p className="mt-1 text-xs font-bold text-ink/55">{activeApplication.title} at {activeApplication.company}</p>}
            <p className="mt-2 text-sm leading-6 text-ink/70">{activeAction.reason}</p>
          </div>
          <span className="rounded-full bg-sun px-2.5 py-1 text-[10px] font-black uppercase tracking-[.14em]">{activeAction.status}</span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-plum" style={{ width: `${totalActions ? (completedActions / totalActions) * 100 : 0}%` }} /></div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={activeAction.routeTarget} className="rounded-full bg-ink px-3 py-1.5 text-xs font-black text-cream">Open action</Link>
          {activeAction.status === "pending" && <>
            <button onClick={() => void updateSessionAction(activeAction.id, "completed")} className="rounded-full bg-mint px-3 py-1.5 text-xs font-black text-ink">Complete</button>
            <button onClick={() => void updateSessionAction(activeAction.id, "snoozed")} className="rounded-full bg-ink/10 px-3 py-1.5 text-xs font-black">Snooze</button>
            <button onClick={() => void updateSessionAction(activeAction.id, "skipped")} className="rounded-full bg-ink/10 px-3 py-1.5 text-xs font-black">Skip</button>
          </>}
        </div>
      </div>}
      {session?.actions?.filter((action) => action.id !== activeAction?.id).map((action) => {
        const application = applications.find((item) => item.id === action.applicationId);
        return <div key={action.id} className="rounded-2xl bg-white/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-black">{action.title}</p>
              {application && <p className="mt-1 text-xs font-bold text-cream/70">{application.title} at {application.company}</p>}
              <p className="mt-2 text-sm leading-6 text-cream/75">{action.reason}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.14em] ${action.status === "pending" ? "bg-sun text-ink" : "bg-mint text-ink"}`}>{action.status}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={action.routeTarget} className="rounded-full bg-cream px-3 py-1.5 text-xs font-black text-ink">Open</Link>
            {action.status === "pending" && <>
              <button onClick={() => void updateSessionAction(action.id, "completed")} className="rounded-full bg-mint px-3 py-1.5 text-xs font-black text-ink">Complete</button>
              <button onClick={() => void updateSessionAction(action.id, "snoozed")} className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-black">Snooze</button>
              <button onClick={() => void updateSessionAction(action.id, "skipped")} className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-black">Skip</button>
            </>}
          </div>
        </div>;
      })}
    </div>
  </section>;
}

function ApplicationWorkspace({
  application,
  events,
  documents,
  contacts,
  interviews,
  outcomes,
  documentJobs,
  contactLibrary,
  preferences,
  insights,
  updateInsight,
  refreshDetail,
  note,
  setNote,
  addNote,
  updateStatus,
  archiveSelected,
  saving,
  rescoreSelected,
}: {
  application?: Application;
  events: ApplicationEvent[];
  documents: ApplicationDocument[];
  contacts: ApplicationContact[];
  interviews: ApplicationInterview[];
  outcomes: ApplicationOutcome[];
  documentJobs: DocumentJob[];
  contactLibrary: NetworkContact[];
  preferences: JobPreferences | null;
  insights: InsightResponse | null;
  updateInsight: (insightId: string, action: "dismissed" | "later" | "active") => Promise<void>;
  refreshDetail: () => Promise<void>;
  note: string;
  setNote: (value: string) => void;
  addNote: (event: FormEvent) => void;
  updateStatus: (status: string) => void;
  archiveSelected: () => void;
  saving: boolean;
  rescoreSelected: () => void;
}) {
  if (!application) {
    return <section className="rounded-3xl border-2 border-dashed border-ink/20 bg-white/50 p-8">
      <Sparkles className="text-coral" />
      <h2 className="mt-4 font-[var(--font-display)] text-2xl font-black">Start with one role.</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-ink/60">CareerGroove will keep the next step visible here: apply, research, remix documents, follow up, prep, or log an outcome.</p>
    </section>;
  }

  return <ApplicationWorkspaceContent
    application={application}
    events={events}
    documents={documents}
    contacts={contacts}
    interviews={interviews}
    outcomes={outcomes}
    documentJobs={documentJobs}
    contactLibrary={contactLibrary}
    preferences={preferences}
    insights={insights}
    updateInsight={updateInsight}
    refreshDetail={refreshDetail}
    note={note}
    setNote={setNote}
    addNote={addNote}
    updateStatus={updateStatus}
    archiveSelected={archiveSelected}
    saving={saving}
    rescoreSelected={rescoreSelected}
  />;
}

function ApplicationWorkspaceContent({
  application,
  events,
  documents,
  contacts,
  interviews,
  outcomes,
  documentJobs,
  contactLibrary,
  preferences,
  insights,
  updateInsight,
  refreshDetail,
  note,
  setNote,
  addNote,
  updateStatus,
  archiveSelected,
  saving,
  rescoreSelected,
}: {
  application: Application;
  events: ApplicationEvent[];
  documents: ApplicationDocument[];
  contacts: ApplicationContact[];
  interviews: ApplicationInterview[];
  outcomes: ApplicationOutcome[];
  documentJobs: DocumentJob[];
  contactLibrary: NetworkContact[];
  preferences: JobPreferences | null;
  insights: InsightResponse | null;
  updateInsight: (insightId: string, action: "dismissed" | "later" | "active") => Promise<void>;
  refreshDetail: () => Promise<void>;
  note: string;
  setNote: (value: string) => void;
  addNote: (event: FormEvent) => void;
  updateStatus: (status: string) => void;
  archiveSelected: () => void;
  saving: boolean;
  rescoreSelected: () => void;
}) {

  const score = application.latestScore;
  const submitted = application.status === "applied" || application.status === "follow_up" || application.status === "interviewing" || application.status === "offer";
  const matchingDocumentJobs = documentJobs.filter((job) => job.targetJob.title === application.title || job.targetJob.company === application.company);
  const latestOffer = outcomes.find((outcome) => ["offer", "accepted", "declined"].includes(outcome.outcome));
  const acceptedOutcome = outcomes.find((outcome) => outcome.outcome === "accepted");
  const research = readRecord(application.metadata?.research);
  const applicationAnswers = readRecord(application.metadata?.applicationAnswers);
  const submission = readRecord(application.metadata?.submission);
  const applicationRemix = readRecord(application.metadata?.applicationRemix);
  const metadataOffer = readRecord(application.metadata?.offer);
  const latestOfferDetails = readRecord(latestOffer?.offer);
  const offerDetails = { ...latestOfferDetails, ...metadataOffer };
  const journeyConversion = readRecord(application.metadata?.journeyConversion);
  const needsRejectionIntelligence = application.status === "rejected" || outcomes.some((outcome) => outcome.outcome === "rejected" || outcome.outcome === "no_response");

  const [activeSection, setActiveSection] = useState("overview");
  const [followUpValue, setFollowUpValue] = useState(application.followUpDueAt ? toLocalDateTime(application.followUpDueAt) : "");
  const [contactForm, setContactForm] = useState({ name: "", relationship: "recruiter", role: "", company: application.company, email: "" });
  const [existingContactId, setExistingContactId] = useState("");
  const [interviewForm, setInterviewForm] = useState({ roundType: "screen", scheduledAt: "", interviewer: "", meetingLink: "", notes: "" });
  const [outcomeForm, setOutcomeForm] = useState({ outcome: "rejected", stage: "", reason: "", userNote: "", source: application.source || "", contactUsed: false, resumeDocumentId: "", coverLetterDocumentId: "", roleFit: "unclear", similarStrategy: "neutral" });
  const [documentLinkJobId, setDocumentLinkJobId] = useState("");
  const [documentLinkStatus, setDocumentLinkStatus] = useState<"draft" | "generated" | "submitted">("generated");
  const [documentGenerating, setDocumentGenerating] = useState("");
  const [answersDraft, setAnswersDraft] = useState(() => answersToText(applicationAnswers.answers));
  const [answersNotice, setAnswersNotice] = useState("");
  const [submissionForm, setSubmissionForm] = useState({
    appliedAt: stringValue(submission.submittedAt),
    confirmationNumber: stringValue(submission.confirmationNumber),
    applicationUrl: stringValue(submission.applicationUrl),
    resumeDocumentId: stringValue(submission.resumeDocumentId),
    coverLetterDocumentId: stringValue(submission.coverLetterDocumentId),
    contactUsed: Boolean(submission.contactUsed),
    followUpDueAt: application.followUpDueAt ? toLocalDateTime(application.followUpDueAt) : "",
    notes: stringValue(submission.notes),
  });
  const [outreachDraft, setOutreachDraft] = useState("");
  const [outreachType, setOutreachType] = useState("recruiter follow-up");
  const [aiLoading, setAiLoading] = useState("");
  const [researchForm, setResearchForm] = useState({
    mission: stringValue(research.mission),
    market: stringValue(research.market),
    interest: stringValue(research.interest),
    redFlags: stringValue(research.redFlags),
    questions: stringValue(research.questions),
  });
  const [offerForm, setOfferForm] = useState({
    salary: stringValue(offerDetails.salary),
    bonus: stringValue(offerDetails.bonus),
    benefitsNotes: stringValue(offerDetails.benefitsNotes),
    location: stringValue(offerDetails.location || application.location),
    schedule: stringValue(offerDetails.schedule),
    remotePolicy: stringValue(offerDetails.remotePolicy || application.workMode),
    startDate: stringValue(offerDetails.startDate),
    decisionDeadline: stringValue(offerDetails.decisionDeadline),
    negotiationStatus: stringValue(offerDetails.negotiationStatus),
  });
  const [conversionDraft, setConversionDraft] = useState({
    title: application.title,
    company: application.company,
    location: application.location || "",
    startedOn: stringValue(offerDetails.startDate),
    rawNotes: `Seeded from accepted application: ${application.title} at ${application.company}.`,
  });
  const [conversionNotice, setConversionNotice] = useState("");

  useEffect(() => {
    setFollowUpValue(application.followUpDueAt ? toLocalDateTime(application.followUpDueAt) : "");
    setContactForm({ name: "", relationship: "recruiter", role: "", company: application.company, email: "" });
    setExistingContactId("");
    setInterviewForm({ roundType: "screen", scheduledAt: "", interviewer: "", meetingLink: "", notes: "" });
    setOutcomeForm({ outcome: "rejected", stage: "", reason: "", userNote: "", source: application.source || "", contactUsed: false, resumeDocumentId: "", coverLetterDocumentId: "", roleFit: "unclear", similarStrategy: "neutral" });
    setDocumentLinkJobId("");
    setDocumentLinkStatus("generated");
    setDocumentGenerating("");
    setAnswersDraft(answersToText(readRecord(application.metadata?.applicationAnswers).answers));
    setAnswersNotice("");
    const nextSubmission = readRecord(application.metadata?.submission);
    setSubmissionForm({
      appliedAt: stringValue(nextSubmission.submittedAt),
      confirmationNumber: stringValue(nextSubmission.confirmationNumber),
      applicationUrl: stringValue(nextSubmission.applicationUrl),
      resumeDocumentId: stringValue(nextSubmission.resumeDocumentId),
      coverLetterDocumentId: stringValue(nextSubmission.coverLetterDocumentId),
      contactUsed: Boolean(nextSubmission.contactUsed),
      followUpDueAt: application.followUpDueAt ? toLocalDateTime(application.followUpDueAt) : "",
      notes: stringValue(nextSubmission.notes),
    });
    setOutreachDraft("");
    setAiLoading("");
    setResearchForm({
      mission: stringValue(readRecord(application.metadata?.research).mission),
      market: stringValue(readRecord(application.metadata?.research).market),
      interest: stringValue(readRecord(application.metadata?.research).interest),
      redFlags: stringValue(readRecord(application.metadata?.research).redFlags),
      questions: stringValue(readRecord(application.metadata?.research).questions),
    });
    const nextOffer = { ...readRecord(latestOffer?.offer), ...readRecord(application.metadata?.offer) };
    setOfferForm({
      salary: stringValue(nextOffer.salary),
      bonus: stringValue(nextOffer.bonus),
      benefitsNotes: stringValue(nextOffer.benefitsNotes),
      location: stringValue(nextOffer.location || application.location),
      schedule: stringValue(nextOffer.schedule),
      remotePolicy: stringValue(nextOffer.remotePolicy || application.workMode),
      startDate: stringValue(nextOffer.startDate),
      decisionDeadline: stringValue(nextOffer.decisionDeadline),
      negotiationStatus: stringValue(nextOffer.negotiationStatus),
    });
    setConversionDraft({
      title: application.title,
      company: application.company,
      location: application.location || "",
      startedOn: stringValue(nextOffer.startDate),
      rawNotes: `Seeded from accepted application: ${application.title} at ${application.company}.`,
    });
    setConversionNotice("");
  }, [application.id, application.company, application.followUpDueAt, application.location, application.metadata, application.source, application.title, application.workMode, latestOffer?.id]);

  async function updateMetadata(nextMetadata: Record<string, unknown>) {
    const response = await fetch(`/api/applications/${application.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metadata: { ...(application.metadata || {}), ...nextMetadata } }),
    });
    if (!response.ok) throw new Error("Application details could not be saved.");
    await refreshDetail();
  }

  async function saveFollowUp() {
    const response = await fetch(`/api/applications/${application.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ followUpDueAt: followUpValue ? new Date(followUpValue).toISOString() : null }),
    });
    if (!response.ok) throw new Error("Follow-up could not be saved.");
    await refreshDetail();
  }

  async function linkContact(event: FormEvent) {
    event.preventDefault();
    const response = await fetch(`/api/applications/${application.id}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(contactForm),
    });
    if (!response.ok) throw new Error("Contact could not be linked.");
    await refreshDetail();
    setContactForm({ name: "", relationship: "recruiter", role: "", company: application.company, email: "" });
  }

  async function linkExistingContact() {
    if (!existingContactId) return;
    const contact = contactLibrary.find((item) => item.id === existingContactId);
    const response = await fetch(`/api/applications/${application.id}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: existingContactId, relationship: "warm_intro", company: contact?.company || application.company }),
    });
    if (!response.ok) throw new Error("Existing contact could not be linked.");
    setExistingContactId("");
    await refreshDetail();
  }

  async function addInterview(event: FormEvent) {
    event.preventDefault();
    const response = await fetch(`/api/applications/${application.id}/interviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...interviewForm,
        scheduledAt: interviewForm.scheduledAt ? new Date(interviewForm.scheduledAt).toISOString() : "",
      }),
    });
    if (!response.ok) throw new Error("Interview could not be added.");
    await refreshDetail();
    setInterviewForm({ roundType: "screen", scheduledAt: "", interviewer: "", meetingLink: "", notes: "" });
  }

  async function logOutcome(event: FormEvent) {
    event.preventDefault();
    const offer = ["offer", "accepted", "declined"].includes(outcomeForm.outcome)
      ? normalizeOfferPayload(offerForm)
      : undefined;
    const response = await fetch(`/api/applications/${application.id}/outcomes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...outcomeForm, offer, contactUsed: outcomeForm.contactUsed, resumeDocumentId: outcomeForm.resumeDocumentId || null, coverLetterDocumentId: outcomeForm.coverLetterDocumentId || null }),
    });
    if (!response.ok) throw new Error("Outcome could not be saved.");
    if (offer) await updateMetadata({ offer });
    await refreshDetail();
    setOutcomeForm({ outcome: "rejected", stage: "", reason: "", userNote: "", source: application.source || "", contactUsed: false, resumeDocumentId: "", coverLetterDocumentId: "", roleFit: "unclear", similarStrategy: "neutral" });
  }

  async function linkDocumentJob(event: FormEvent) {
    event.preventDefault();
    if (!documentLinkJobId) return;
    const job = documentJobs.find((item) => item.id === documentLinkJobId);
    const kind = job?.kind === "cover_letter" ? "cover_letter" : "resume";
    const response = await fetch(`/api/applications/${application.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentGenerationJobId: documentLinkJobId, kind, status: documentLinkStatus, submittedAt: documentLinkStatus === "submitted" ? new Date().toISOString() : "" }),
    });
    if (!response.ok) throw new Error("Document could not be linked.");
    await refreshDetail();
    setDocumentLinkJobId("");
  }

  async function saveResearch(event: FormEvent) {
    event.preventDefault();
    await updateMetadata({ research: researchForm });
  }

  async function generateApplicationDocument(kind: "resume" | "cover_letter" | "both") {
    setDocumentGenerating(kind);
    try {
      const response = await fetch("/api/document-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, applicationId: application.id }),
      });
      if (!response.ok) throw new Error("Document remix could not be queued.");
      await refreshDetail();
    } finally {
      setDocumentGenerating("");
    }
  }

  async function refreshRemixSummary() {
    const response = await fetch(`/api/applications/${application.id}/remix`, { method: "POST" });
    if (!response.ok) throw new Error("Remix summary could not be refreshed.");
    await refreshDetail();
  }

  async function saveAnswers() {
    const answers = parseAnswersText(answersDraft);
    if (!answers.length) {
      setAnswersNotice("Add at least one question and answer.");
      return;
    }
    const response = await fetch(`/api/applications/${application.id}/answers`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText: answersDraft }),
    });
    setAnswersNotice(response.ok ? "Application answers saved." : "Answers could not be saved.");
    if (response.ok) await refreshDetail();
  }

  async function generateAnswers() {
    setAiLoading("answers");
    setAnswersNotice("");
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: "application-answers",
          context: { application, research: researchForm, existingAnswers: parseAnswersText(answersDraft) },
          messages: [{ role: "user", content: answersDraft || "Draft concise reusable answers for the most likely screening questions for this role." }],
        }),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(text || "AI answers could not be generated.");
      setAnswersDraft(text);
    } catch (error) {
      setAnswersNotice(error instanceof Error ? error.message : "AI answers could not be generated.");
    } finally {
      setAiLoading("");
    }
  }

  async function recordSubmission() {
    const response = await fetch(`/api/applications/${application.id}/submission`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...submissionForm,
        appliedAt: submissionForm.appliedAt ? new Date(submissionForm.appliedAt).toISOString() : "",
        followUpDueAt: submissionForm.followUpDueAt ? new Date(submissionForm.followUpDueAt).toISOString() : "",
        resumeDocumentId: submissionForm.resumeDocumentId || null,
        coverLetterDocumentId: submissionForm.coverLetterDocumentId || null,
      }),
    });
    if (!response.ok) throw new Error("Submission could not be recorded.");
    await refreshDetail();
  }

  async function generateOutreachDraft() {
    setAiLoading("outreach");
    setOutreachDraft("");
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: "outreach-draft",
          context: { application, contacts, contactForm, outreachType, research: researchForm, offer: offerForm },
          messages: [{ role: "user", content: `Draft a ${outreachType} for ${application.title} at ${application.company}.` }],
        }),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(text || "Outreach draft could not be generated.");
      setOutreachDraft(text);
    } catch (error) {
      setOutreachDraft(error instanceof Error ? error.message : "Outreach draft could not be generated.");
    } finally {
      setAiLoading("");
    }
  }

  async function saveOffer(event?: FormEvent) {
    event?.preventDefault();
    const offer = normalizeOfferPayload(offerForm);
    const response = await fetch(`/api/applications/${application.id}/outcomes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome: "offer", reason: "Offer details updated", offer }),
    });
    if (!response.ok) throw new Error("Offer details could not be saved.");
    await updateMetadata({ offer });
  }

  async function quickOfferDecision(outcome: "accepted" | "declined") {
    const offer = normalizeOfferPayload(offerForm);
    const response = await fetch(`/api/applications/${application.id}/outcomes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outcome,
        reason: outcome === "accepted" ? "Accepted with confirmation" : "Declined with confirmation",
        userNote: outcome === "accepted" ? "Accepted this offer." : "Declined this offer.",
        offer,
      }),
    });
    if (!response.ok) throw new Error("Offer decision could not be saved.");
    await updateMetadata({ offer });
  }

  async function stageConversion() {
    setConversionNotice("");
    const response = await fetch(`/api/applications/${application.id}/conversion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: false, draft: conversionDraft }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setConversionNotice(typeof data.error === "string" ? data.error : "Journey draft could not be staged.");
      return;
    }
    setConversionNotice("Draft staged. Confirm when you want it added to Journey.");
    await refreshDetail();
  }

  async function confirmConversion() {
    setConversionNotice("");
    const response = await fetch(`/api/applications/${application.id}/conversion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true, draft: conversionDraft }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setConversionNotice(typeof data.error === "string" ? data.error : "Journey chapter could not be created.");
      return;
    }
    setConversionNotice("Journey chapter seed created.");
    await refreshDetail();
  }

  return <section className="space-y-5">
    <div id="application-section-overview" className="scroll-mt-6 rounded-3xl border-2 border-ink bg-white p-5 shadow-[0_5px_0_#26312c]">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-plum">Next move</p>
          <h2 className="mt-1 break-words font-[var(--font-display)] text-3xl font-black">{application.title}</h2>
          <p className="mt-1 text-sm font-bold text-ink/55">{application.company}{application.location ? ` - ${application.location}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={application.status} disabled={saving} onChange={(event) => void updateStatus(event.target.value)} className="rounded-2xl border-2 border-ink bg-cream px-3 py-2 text-sm font-black">
            {statusOptions.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
          </select>
          <button onClick={() => void rescoreSelected()} disabled={saving} className="grid size-11 place-items-center rounded-2xl border-2 border-ink bg-cream" title="Refresh Career DJ">{saving ? <LoaderCircle size={18} className="animate-spin" /> : <RefreshCw size={18} />}</button>
          <button onClick={archiveSelected} disabled={saving} className="grid size-11 place-items-center rounded-2xl border-2 border-ink bg-white" title="Archive role"><Archive size={18} /></button>
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-mint/30 p-4">
        <div className="flex items-start gap-3">
          <ArrowRight className="mt-1 shrink-0 text-plum" size={20} />
          <div>
            <p className="font-black">{labelText[application.priorityLabel || ""] || "Review this lead"}</p>
            <p className="mt-1 text-sm leading-6 text-ink/65">{friendlyAction(application)}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <InfoTile icon={<ClipboardList size={18} />} label="Status" value={statusLabels[application.status as keyof typeof statusLabels]} />
        <InfoTile icon={<CalendarClock size={18} />} label="Saved" value={formatDate(application.createdAt)} />
        <InfoTile icon={<FileText size={18} />} label="Documents" value={documents.length ? `${documents.length} linked` : "Ready to connect"} />
        <InfoTile icon={<UserRoundPlus size={18} />} label="Network" value={contacts.length ? `${contacts.length} contact${contacts.length === 1 ? "" : "s"}` : "No contact yet"} />
      </div>
    </div>

    <nav className="flex gap-2 overflow-x-auto rounded-3xl border-2 border-ink/10 bg-white/70 p-2 text-xs font-black">
      {[
        ["overview", "Overview"],
        ["career", "Career DJ"],
        ["checklist", "Checklist"],
        ["documents", "Documents"],
        ["submission", "Apply"],
        ["research", "Research"],
        ["network", "Network"],
        ["timeline", "Timeline"],
        [application.status === "offer" ? "offer" : needsRejectionIntelligence ? "rejection" : "outcome", application.status === "offer" ? "Offer" : needsRejectionIntelligence ? "Rejection" : "Outcome"],
      ].map(([id, label]) => <button key={id} onClick={() => {
        setActiveSection(id);
        document.getElementById(`application-section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }} className={`shrink-0 rounded-full px-3 py-2 ${activeSection === id ? "bg-ink text-cream" : "bg-cream text-ink/65"}`}>{label}</button>)}
    </nav>

    <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
      <section id="application-section-career" className="scroll-mt-6 rounded-3xl border-2 border-ink/15 bg-white/70 p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-[var(--font-display)] text-xl font-black">Career DJ</h3>
          <span className="rounded-full bg-sun/70 px-3 py-1 text-xs font-black">{labelText[application.priorityLabel || ""] || "Needs review"}</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <ScoreTile label="Fit" value={scoreBadgeValue(score?.fit)} />
          <ScoreTile label="Readiness" value={scoreBadgeValue(score?.readiness)} />
          <ScoreTile label="Timing" value={scoreBadgeValue(score?.timing)} />
          <ScoreTile label="Desire" value={scoreBadgeValue(score?.desire)} />
          <ScoreTile label="Leverage" value={scoreBadgeValue(score?.leverage)} />
          <ScoreTile label="Risk" value={scoreBadgeValue(score?.risk)} />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-cream p-4">
            <p className="text-xs font-black uppercase tracking-[.18em] text-plum">Why it is promising</p>
            <div className="mt-3 space-y-2">
              {score?.reasons?.length ? score.reasons.map((reason) => <p key={reason} className="text-sm font-bold text-ink/70">{reason}</p>) : <p className="text-sm font-bold text-ink/55">Save a stronger role description or add more Journey context to get sharper reasons here.</p>}
            </div>
          </div>
          <div className="rounded-2xl bg-cream p-4">
            <p className="text-xs font-black uppercase tracking-[.18em] text-plum">What needs attention</p>
            <div className="mt-3 space-y-2">
              {score?.gaps?.length ? score.gaps.map((gap) => <p key={gap} className="text-sm font-bold text-ink/70">{gap}</p>) : <p className="text-sm font-bold text-ink/55">No major gaps surfaced on the latest pass.</p>}
            </div>
          </div>
        </div>
      </section>

      <section id="application-section-checklist" className="scroll-mt-6 rounded-3xl border-2 border-ink/15 bg-white/70 p-5">
        <h3 className="font-[var(--font-display)] text-xl font-black">Checklist</h3>
        <div className="mt-4 space-y-3 text-sm">
          <ChecklistItem done={Boolean(application.description)} label="Role captured" />
          <ChecklistItem done={Boolean(application.priorityLabel)} label="Career DJ score" />
          <ChecklistItem done={submitted} label="Application submitted" />
          <ChecklistItem done={Boolean(application.followUpDueAt)} label="Follow-up reminder" />
          <ChecklistItem done={documents.length > 0} label="Document draft linked" />
          <ChecklistItem done={contacts.length > 0} label="Contact or referral linked" />
        </div>
        <div className="mt-5 grid gap-2">
          <ActionLink href="/documents" icon={<FileText size={15} />} label="Open Document Studio" />
          <ActionLink href="/network" icon={<UserRoundPlus size={15} />} label="Open Network" />
          <ActionLink href="/mock-interview" icon={<Sparkles size={15} />} label="Open Soundcheck" />
        </div>
      </section>
    </div>

    <section id="application-section-submission" className="scroll-mt-6 rounded-3xl border-2 border-ink/15 bg-white/70 p-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-plum">Application Answers & Submission</p>
          <h3 className="font-[var(--font-display)] text-xl font-black">Prep the form without losing the thread</h3>
          <p className="mt-1 text-sm leading-6 text-ink/60">Save reusable answers, then record exactly what went out.</p>
        </div>
        <button onClick={() => void generateAnswers()} disabled={aiLoading === "answers"} className="rounded-2xl border-2 border-ink bg-sun px-4 py-2.5 text-sm font-black disabled:opacity-60">{aiLoading === "answers" ? "Drafting..." : "Draft answers"}</button>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <div>
          <textarea value={answersDraft} onChange={(event) => setAnswersDraft(event.target.value)} placeholder={"Paste screening questions and draft answers here.\n\nFormat:\nQ: Are you authorized to work in the US?\nA: Yes.\nSource: Profile\nConfidence: high"} className="min-h-64 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => void saveAnswers()} className="rounded-2xl border-2 border-ink bg-mint px-4 py-2.5 text-sm font-black">Save answers</button>
            {answersNotice && <p className="rounded-2xl bg-white px-3 py-2 text-sm font-bold text-ink/65">{answersNotice}</p>}
          </div>
        </div>
        <div className="rounded-2xl bg-cream p-4">
          <p className="text-xs font-black uppercase tracking-[.18em] text-plum">Record submission</p>
          <input type="datetime-local" value={submissionForm.appliedAt} onChange={(event) => setSubmissionForm({ ...submissionForm, appliedAt: event.target.value })} className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none" />
          <input value={submissionForm.confirmationNumber} onChange={(event) => setSubmissionForm({ ...submissionForm, confirmationNumber: event.target.value })} placeholder="Confirmation number" className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none" />
          <input value={submissionForm.applicationUrl} onChange={(event) => setSubmissionForm({ ...submissionForm, applicationUrl: event.target.value })} placeholder="Application or confirmation URL" className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none" />
          <select value={submissionForm.resumeDocumentId} onChange={(event) => setSubmissionForm({ ...submissionForm, resumeDocumentId: event.target.value })} className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none">
            <option value="">Submitted resume version</option>
            {documents.filter((document) => document.kind === "resume").map((document) => <option key={document.id} value={document.id}>{document.title || "Resume"} · {document.status}</option>)}
          </select>
          <select value={submissionForm.coverLetterDocumentId} onChange={(event) => setSubmissionForm({ ...submissionForm, coverLetterDocumentId: event.target.value })} className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none">
            <option value="">Submitted cover letter version</option>
            {documents.filter((document) => document.kind === "cover_letter").map((document) => <option key={document.id} value={document.id}>{document.title || "Cover letter"} · {document.status}</option>)}
          </select>
          <input type="datetime-local" value={submissionForm.followUpDueAt} onChange={(event) => setSubmissionForm({ ...submissionForm, followUpDueAt: event.target.value })} className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none" />
          <label className="mt-3 flex gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold"><input type="checkbox" checked={submissionForm.contactUsed} onChange={(event) => setSubmissionForm({ ...submissionForm, contactUsed: event.target.checked })} /> Contact or referral used</label>
          <textarea value={submissionForm.notes} onChange={(event) => setSubmissionForm({ ...submissionForm, notes: event.target.value })} placeholder="Submission notes" className="mt-3 min-h-20 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none" />
          <button onClick={() => void recordSubmission()} className="mt-3 rounded-2xl border-2 border-ink bg-mint px-4 py-2.5 text-sm font-black">Mark Applied</button>
        </div>
      </div>
    </section>

    <section id="application-section-research" className="scroll-mt-6 rounded-3xl border-2 border-ink/15 bg-white/70 p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-plum">Research</p>
          <h3 className="font-[var(--font-display)] text-xl font-black">Company soundcheck</h3>
          <p className="mt-1 text-sm leading-6 text-ink/60">Capture signal you can use in interviews, outreach, and document tailoring.</p>
        </div>
        {application.sourceUrl && <a href={application.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-cream px-3 py-2 text-xs font-black">Posting <ExternalLink size={14} /></a>}
      </div>
      <form onSubmit={(event) => void saveResearch(event)} className="mt-4 grid gap-3 lg:grid-cols-2">
        <ResearchField label="Mission / company angle" value={researchForm.mission} onChange={(mission) => setResearchForm({ ...researchForm, mission })} />
        <ResearchField label="Product / market notes" value={researchForm.market} onChange={(market) => setResearchForm({ ...researchForm, market })} />
        <ResearchField label="Reasons for interest" value={researchForm.interest} onChange={(interest) => setResearchForm({ ...researchForm, interest })} />
        <ResearchField label="Red flags" value={researchForm.redFlags} onChange={(redFlags) => setResearchForm({ ...researchForm, redFlags })} />
        <label className="lg:col-span-2 block text-xs font-black uppercase tracking-[.18em] text-plum">Questions to ask
          <textarea value={researchForm.questions} onChange={(event) => setResearchForm({ ...researchForm, questions: event.target.value })} className="mt-2 min-h-24 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold normal-case outline-none" />
        </label>
        <button className="w-fit rounded-2xl border-2 border-ink bg-mint px-4 py-2.5 text-sm font-black">Save research</button>
      </form>
    </section>

    <div className="grid gap-5 xl:grid-cols-[1fr_.95fr]">
      <section className="rounded-3xl border-2 border-ink/15 bg-white/70 p-5">
        <h3 className="font-[var(--font-display)] text-xl font-black">Opportunity workspace</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <DetailCard label="Source" value={application.source || "Captured manually"} />
          <DetailCard label="Work mode" value={application.workMode || "Unknown"} />
          <DetailCard label="Salary" value={formatSalary(application.salaryMin, application.salaryMax, application.salaryCurrency)} />
          <DetailCard label="Follow-up" value={application.followUpDueAt ? formatDate(application.followUpDueAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Not scheduled"} />
        </div>
        <div className="mt-5 rounded-2xl bg-cream p-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-black">Job description</h4>
            {application.sourceUrl && <a href={application.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-black text-plum underline decoration-coral decoration-2 underline-offset-4">Open source <ExternalLink size={14} /></a>}
          </div>
          <p className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-sm leading-6 text-ink/70">{application.description}</p>
        </div>
      </section>

      <section id="application-section-documents" className="scroll-mt-6 rounded-3xl border-2 border-ink/15 bg-white/70 p-5">
        <h3 className="font-[var(--font-display)] text-xl font-black">Linked context</h3>
        <div className="mt-4 rounded-2xl bg-cream p-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-plum">Application Remix</p>
              <p className="mt-1 text-sm font-bold text-ink/65">{stringValue(applicationRemix.angle) || "Generate a grounded remix summary before tailoring documents."}</p>
            </div>
            <button onClick={() => void refreshRemixSummary()} className="rounded-2xl border-2 border-ink bg-white px-3 py-2 text-xs font-black">Refresh summary</button>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <SummaryBlock title="Chapters to emphasize" empty="No matching Journey chapters identified yet.">
              {arrayValue(applicationRemix.chapters).map((chapter) => {
                const item = readRecord(chapter);
                return <p key={stringValue(item.id) || stringValue(item.title)} className="text-sm font-bold text-ink/70">{stringValue(item.title)}{item.company ? ` · ${stringValue(item.company)}` : ""}{item.reason ? ` · ${stringValue(item.reason)}` : ""}</p>;
              })}
            </SummaryBlock>
            <SummaryBlock title="Keywords and missing evidence" empty="Refresh the summary to identify keywords and evidence gaps.">
              {[...arrayValue(applicationRemix.keywords).slice(0, 8).map(String), ...arrayValue(applicationRemix.missingEvidence).slice(0, 4).map((item) => `Missing: ${String(item)}`)].map((item) => <p key={item} className="text-sm font-bold text-ink/70">{item}</p>)}
            </SummaryBlock>
          </div>
          <p className="mt-3 rounded-xl bg-white/70 p-3 text-sm font-bold text-ink/70">{stringValue(applicationRemix.coverLetterAngle) || "Cover-letter angle will appear here after refresh."}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["resume", "cover_letter", "both"] as const).map((kind) => <button key={kind} disabled={Boolean(documentGenerating)} onClick={() => void generateApplicationDocument(kind)} className="rounded-2xl border-2 border-ink bg-sun px-3 py-2 text-xs font-black disabled:opacity-60">{documentGenerating === kind ? "Queuing..." : `Generate ${kind.replace("_", " ")}`}</button>)}
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <SummaryBlock title="Documents" empty="No application-linked drafts yet.">
            {documents.map((document) => <p key={document.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2 text-sm font-bold text-ink/70">
              <span>{document.title || document.kind.replace("_", " ")}</span>
              <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[.14em] ${document.status === "submitted" ? "bg-mint" : document.status === "generated" ? "bg-sun/70" : "bg-ink/10"}`}>{document.status}</span>
            </p>)}
          </SummaryBlock>
          <SummaryBlock title="Network" empty="No referral or recruiter saved yet.">
            {contacts.map((contact) => <p key={contact.id} className="text-sm font-bold text-ink/70">{contact.name}{contact.relationship ? ` · ${titleCase(contact.relationship.replace("_", " "))}` : ""}{contact.role ? ` · ${contact.role}` : ""}{contact.company ? ` @ ${contact.company}` : ""}</p>)}
          </SummaryBlock>
          <SummaryBlock title="Interviews" empty="No interview rounds recorded yet.">
            {interviews.map((interview) => <p key={interview.id} className="text-sm font-bold text-ink/70">{titleCase(interview.roundType)} · {interview.scheduledAt ? formatDate(interview.scheduledAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Schedule TBD"}</p>)}
          </SummaryBlock>
          <SummaryBlock title="Outcomes" empty="No outcome logged yet.">
            {outcomes.map((outcome) => <p key={outcome.id} className="text-sm font-bold text-ink/70">{titleCase(outcome.outcome.replace("_", " "))} · {formatDate(outcome.occurredAt)}{outcome.reason ? ` · ${outcome.reason}` : ""}</p>)}
          </SummaryBlock>
        </div>
      </section>
    </div>

    {(application.status === "offer" || latestOffer || preferences) && <OfferWorkflowCard
      application={application}
      offerForm={offerForm}
      setOfferForm={setOfferForm}
      saveOffer={saveOffer}
      quickOfferDecision={quickOfferDecision}
      preferences={preferences}
      offerOutcomes={outcomes.filter((outcome) => ["offer", "accepted", "declined"].includes(outcome.outcome))}
      accepted={Boolean(acceptedOutcome)}
      conversionDraft={conversionDraft}
      setConversionDraft={setConversionDraft}
      stageConversion={stageConversion}
      confirmConversion={confirmConversion}
      conversionNotice={conversionNotice}
      converted={Boolean(journeyConversion.jobId)}
    />}

    <RejectionIntelligenceCard insights={insights} lowData={Boolean(insights?.lowData)} visible={needsRejectionIntelligence || Boolean(insights?.insights?.length)} updateInsight={updateInsight} />

    <div className="grid gap-5 xl:grid-cols-2">
      <form onSubmit={(event) => void linkDocumentJob(event)} className="rounded-3xl border-2 border-ink/15 bg-white/70 p-5">
        <h3 className="font-[var(--font-display)] text-xl font-black">Link a draft</h3>
        <select value={documentLinkJobId} onChange={(event) => setDocumentLinkJobId(event.target.value)} className="mt-4 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none">
          <option value="">Choose a draft</option>
          {matchingDocumentJobs.map((job) => <option key={job.id} value={job.id}>{job.kind} · {job.targetJob.company} · {formatDate(job.createdAt)}</option>)}
        </select>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["draft", "generated", "submitted"] as const).map((status) => <button type="button" key={status} onClick={() => setDocumentLinkStatus(status)} className={`rounded-full px-3 py-1.5 text-xs font-black ${documentLinkStatus === status ? "bg-sun" : "bg-cream"}`}>{status}</button>)}
        </div>
        <button disabled={!documentLinkJobId} className="mt-3 rounded-2xl border-2 border-ink bg-mint px-4 py-2.5 text-sm font-black disabled:opacity-60">Link selected draft</button>
      </form>

      <div id="application-section-timeline" className="scroll-mt-6 rounded-3xl border-2 border-ink/15 bg-white/70 p-5">
        <h3 className="font-[var(--font-display)] text-xl font-black">Follow-up</h3>
        <input type="datetime-local" value={followUpValue} onChange={(event) => setFollowUpValue(event.target.value)} className="mt-4 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
        <button onClick={() => void saveFollowUp()} className="mt-3 rounded-2xl border-2 border-ink bg-mint px-4 py-2.5 text-sm font-black">Save follow-up date</button>
      </div>
    </div>

    <div className="grid gap-5 xl:grid-cols-3">
      <form id="application-section-network" onSubmit={(event) => void linkContact(event)} className="scroll-mt-6 rounded-3xl border-2 border-ink/15 bg-white/70 p-5">
        <h3 className="font-[var(--font-display)] text-xl font-black">Add contact</h3>
        {application.priorityLabel === "network_first" && <p className="mt-2 rounded-2xl bg-mint/30 p-3 text-sm font-bold text-ink/70">Career DJ recommends contact-first here. A recruiter note, referral ask, or warm intro is enough.</p>}
        <select value={existingContactId} onChange={(event) => setExistingContactId(event.target.value)} className="mt-4 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none">
          <option value="">Attach existing Network contact</option>
          {contactLibrary.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}{contact.company ? ` · ${contact.company}` : ""}</option>)}
        </select>
        <button type="button" disabled={!existingContactId} onClick={() => void linkExistingContact()} className="mt-2 rounded-2xl border-2 border-ink bg-white px-4 py-2.5 text-sm font-black disabled:opacity-60">Attach selected</button>
        <input value={contactForm.name} onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })} placeholder="Name" className="mt-4 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
        <select value={contactForm.relationship} onChange={(event) => setContactForm({ ...contactForm, relationship: event.target.value })} className="mt-3 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none">
          <option value="recruiter">Recruiter</option>
          <option value="hiring_manager">Hiring manager</option>
          <option value="referral">Referral</option>
          <option value="warm_intro">Warm intro</option>
          <option value="teammate">Potential teammate</option>
          <option value="other">Other</option>
        </select>
        <input value={contactForm.role} onChange={(event) => setContactForm({ ...contactForm, role: event.target.value })} placeholder="Role" className="mt-3 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
        <input value={contactForm.email} onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })} placeholder="Email" className="mt-3 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
        <button disabled={!contactForm.name.trim()} className="mt-3 rounded-2xl border-2 border-ink bg-mint px-4 py-2.5 text-sm font-black disabled:opacity-60">Link contact</button>
        <div className="mt-5 rounded-2xl bg-cream p-4">
          <p className="text-xs font-black uppercase tracking-[.18em] text-plum">Outreach draft</p>
          <select value={outreachType} onChange={(event) => setOutreachType(event.target.value)} className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none">
            {["referral request", "recruiter follow-up", "thank-you note", "post-final-round check-in", "offer negotiation note", "relationship maintenance"].map((type) => <option key={type}>{type}</option>)}
          </select>
          <button type="button" onClick={() => void generateOutreachDraft()} disabled={aiLoading === "outreach"} className="mt-3 rounded-2xl border-2 border-ink bg-sun px-4 py-2.5 text-sm font-black disabled:opacity-60">{aiLoading === "outreach" ? "Drafting..." : "Draft note"}</button>
          {outreachDraft && <textarea value={outreachDraft} onChange={(event) => setOutreachDraft(event.target.value)} className="mt-3 min-h-40 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none" />}
        </div>
      </form>

      <form onSubmit={(event) => void addInterview(event)} className="rounded-3xl border-2 border-ink/15 bg-white/70 p-5">
        <h3 className="font-[var(--font-display)] text-xl font-black">Add interview</h3>
        <input value={interviewForm.roundType} onChange={(event) => setInterviewForm({ ...interviewForm, roundType: event.target.value })} placeholder="Round type" className="mt-4 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
        <input type="datetime-local" value={interviewForm.scheduledAt} onChange={(event) => setInterviewForm({ ...interviewForm, scheduledAt: event.target.value })} className="mt-3 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
        <input value={interviewForm.interviewer} onChange={(event) => setInterviewForm({ ...interviewForm, interviewer: event.target.value })} placeholder="Interviewer" className="mt-3 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
        <input value={interviewForm.meetingLink} onChange={(event) => setInterviewForm({ ...interviewForm, meetingLink: event.target.value })} placeholder="Meeting link" className="mt-3 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
        <textarea value={interviewForm.notes} onChange={(event) => setInterviewForm({ ...interviewForm, notes: event.target.value })} placeholder="Prep notes" className="mt-3 min-h-20 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="rounded-2xl border-2 border-ink bg-mint px-4 py-2.5 text-sm font-black">Save interview</button>
          <Link href={`/mock-interview?applicationId=${application.id}`} className="rounded-2xl border-2 border-ink bg-white px-4 py-2.5 text-sm font-black">Open Soundcheck</Link>
        </div>
      </form>

      <form id="application-section-outcome" onSubmit={(event) => void logOutcome(event)} className="scroll-mt-6 rounded-3xl border-2 border-ink/15 bg-white/70 p-5">
        <h3 className="font-[var(--font-display)] text-xl font-black">Log outcome</h3>
        <select value={outcomeForm.outcome} onChange={(event) => setOutcomeForm({ ...outcomeForm, outcome: event.target.value })} className="mt-4 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none">
          <option value="rejected">Rejected</option>
          <option value="no_response">No response</option>
          <option value="withdrew">Withdrew</option>
          <option value="offer">Offer</option>
          <option value="accepted">Accepted</option>
          <option value="declined">Declined</option>
        </select>
        <input value={outcomeForm.stage} onChange={(event) => setOutcomeForm({ ...outcomeForm, stage: event.target.value })} placeholder="Stage (applied, recruiter screen, onsite...)" className="mt-3 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
        <input value={outcomeForm.reason} onChange={(event) => setOutcomeForm({ ...outcomeForm, reason: event.target.value })} placeholder="Reason or signal" className="mt-3 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
        <input value={outcomeForm.source} onChange={(event) => setOutcomeForm({ ...outcomeForm, source: event.target.value })} placeholder="Source" className="mt-3 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
        <select value={outcomeForm.resumeDocumentId} onChange={(event) => setOutcomeForm({ ...outcomeForm, resumeDocumentId: event.target.value })} className="mt-3 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none">
          <option value="">Resume used</option>
          {documents.filter((document) => document.kind === "resume").map((document) => <option key={document.id} value={document.id}>{document.title || "Resume"} · {document.status}</option>)}
        </select>
        <select value={outcomeForm.coverLetterDocumentId} onChange={(event) => setOutcomeForm({ ...outcomeForm, coverLetterDocumentId: event.target.value })} className="mt-3 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none">
          <option value="">Cover letter used</option>
          {documents.filter((document) => document.kind === "cover_letter").map((document) => <option key={document.id} value={document.id}>{document.title || "Cover letter"} · {document.status}</option>)}
        </select>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <select value={outcomeForm.roleFit} onChange={(event) => setOutcomeForm({ ...outcomeForm, roleFit: event.target.value })} className="rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none">
            <option value="unclear">Fit felt unclear</option>
            <option value="fit">Felt like a fit</option>
            <option value="stretch">Felt like a stretch</option>
            <option value="mismatch">Felt like a mismatch</option>
          </select>
          <select value={outcomeForm.similarStrategy} onChange={(event) => setOutcomeForm({ ...outcomeForm, similarStrategy: event.target.value })} className="rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none">
            <option value="neutral">No targeting change</option>
            <option value="prioritize">Prioritize similar roles</option>
            <option value="deprioritize">Deprioritize similar roles</option>
          </select>
        </div>
        <label className="mt-3 flex gap-2 rounded-2xl bg-cream px-4 py-3 text-sm font-bold"><input type="checkbox" checked={outcomeForm.contactUsed} onChange={(event) => setOutcomeForm({ ...outcomeForm, contactUsed: event.target.checked })} /> Referral/contact involved</label>
        {(outcomeForm.outcome === "offer" || outcomeForm.outcome === "accepted" || outcomeForm.outcome === "declined") && <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input value={offerForm.salary} onChange={(event) => setOfferForm({ ...offerForm, salary: event.target.value })} placeholder="Salary" className="rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
          <input value={offerForm.decisionDeadline} onChange={(event) => setOfferForm({ ...offerForm, decisionDeadline: event.target.value })} placeholder="Decision deadline (YYYY-MM-DD)" className="rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
          <input value={offerForm.schedule} onChange={(event) => setOfferForm({ ...offerForm, schedule: event.target.value })} placeholder="Schedule" className="rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
          <input value={offerForm.remotePolicy} onChange={(event) => setOfferForm({ ...offerForm, remotePolicy: event.target.value })} placeholder="Remote policy" className="rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
        </div>}
        <textarea value={outcomeForm.userNote} onChange={(event) => setOutcomeForm({ ...outcomeForm, userNote: event.target.value })} placeholder="What happened?" className="mt-3 min-h-24 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
        <button className="mt-3 rounded-2xl border-2 border-ink bg-mint px-4 py-2.5 text-sm font-black">Save outcome</button>
      </form>
    </div>

    <div className="grid gap-5 xl:grid-cols-[.85fr_1fr]">
      <form onSubmit={addNote} className="rounded-3xl border-2 border-ink/15 bg-white/70 p-5">
        <h3 className="font-[var(--font-display)] text-xl font-black">Add a note</h3>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="What changed? Who did you talk to? What should future you remember?" className="mt-4 min-h-32 w-full resize-y rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
        <button disabled={saving || !note.trim()} className="mt-3 flex items-center gap-2 rounded-2xl border-2 border-ink bg-sun px-4 py-3 text-sm font-black shadow-[0_3px_0_#26312c] disabled:opacity-60"><Plus size={17} /> Save note</button>
      </form>

      <div className="rounded-3xl border-2 border-ink/15 bg-white/70 p-5">
        <h3 className="font-[var(--font-display)] text-xl font-black">Timeline</h3>
        <div className="mt-4 space-y-4">
          {events.length ? groupEventsByDate(events).map((group) => <section key={group.label}>
            <p className="mb-2 text-xs font-black uppercase tracking-[.18em] text-plum">{group.label}</p>
            <div className="space-y-3">{group.events.map((event) => <div key={event.id} className="rounded-2xl bg-cream p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-black">{event.title}</p>
                <span className="shrink-0 text-xs font-bold text-ink/45">{formatDate(event.occurredAt, { hour: "numeric", minute: "2-digit" })}</span>
              </div>
              {event.body && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink/60">{event.body}</p>}
            </div>)}</div>
          </section>) : <p className="rounded-2xl bg-cream p-4 text-sm font-bold text-ink/55">Timeline events will appear as you save notes, change status, complete setlist actions, and log outcomes.</p>}
        </div>
      </div>
    </div>
  </section>;
}

function InfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl bg-cream p-4">
    <div className="flex items-center gap-2 text-plum">{icon}<span className="text-[10px] font-black uppercase tracking-[.18em]">{label}</span></div>
    <p className="mt-2 truncate font-black">{value}</p>
  </div>;
}

function ScoreTile({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border-2 border-ink/10 bg-white px-4 py-3">
    <p className="text-[10px] font-black uppercase tracking-[.18em] text-plum">{label}</p>
    <p className="mt-2 font-black">{value}</p>
  </div>;
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return <div className="flex items-center gap-3 rounded-2xl bg-cream p-3">
    <span className={`grid size-6 shrink-0 place-items-center rounded-full border-2 border-ink text-xs font-black ${done ? "bg-mint" : "bg-white"}`}>{done && <Check size={14} />}</span>
    <span className="font-bold">{label}</span>
  </div>;
}

function ActionLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return <Link href={href} className="flex items-center justify-between rounded-2xl bg-cream px-4 py-3 text-sm font-black hover:bg-lilac/20">
    <span className="flex items-center gap-2">{icon}{label}</span>
    <ArrowRight size={15} />
  </Link>;
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-white px-4 py-3">
    <p className="text-[10px] font-black uppercase tracking-[.18em] text-plum">{label}</p>
    <p className="mt-2 text-sm font-bold text-ink/70">{value}</p>
  </div>;
}

function SummaryBlock({ title, children, empty }: { title: string; children: ReactNode; empty: string }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <div className="rounded-2xl bg-cream p-4">
    <p className="text-xs font-black uppercase tracking-[.18em] text-plum">{title}</p>
    <div className="mt-3 space-y-2">{hasChildren ? children : <p className="text-sm font-bold text-ink/55">{empty}</p>}</div>
  </div>;
}

function formatSalary(min: number | null, max: number | null, currency: string) {
  if (!min && !max) return "Not listed";
  const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: 0 });
  if (min && max) return `${formatter.format(min)} - ${formatter.format(max)}`;
  return formatter.format(min || max || 0);
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

function groupEventsByDate(events: ApplicationEvent[]) {
  const formatter = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
  const groups = new Map<string, ApplicationEvent[]>();
  for (const event of events) {
    const label = formatter.format(new Date(event.occurredAt));
    groups.set(label, [...(groups.get(label) || []), event]);
  }
  return [...groups.entries()].map(([label, groupedEvents]) => ({ label, events: groupedEvents }));
}

function toLocalDateTime(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function ResearchField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-xs font-black uppercase tracking-[.18em] text-plum">{label}
    <textarea value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-24 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold normal-case outline-none" />
  </label>;
}

function RejectionIntelligenceCard({
  insights,
  lowData,
  visible,
  updateInsight,
}: {
  insights: InsightResponse | null;
  lowData: boolean;
  visible: boolean;
  updateInsight: (insightId: string, action: "dismissed" | "later" | "active") => Promise<void>;
}) {
  if (!visible) return null;
  return <section id="application-section-rejection" className="scroll-mt-6 rounded-3xl border-2 border-ink/15 bg-white/70 p-5">
    <div className="flex items-start gap-3">
      <div className="grid size-11 shrink-0 place-items-center rounded-2xl border-2 border-ink bg-lilac/30"><Sparkles size={19} /></div>
      <div>
        <p className="text-xs font-black uppercase tracking-[.18em] text-plum">Rejection Intelligence</p>
        <h3 className="font-[var(--font-display)] text-xl font-black">Gentle pattern review</h3>
        <p className="mt-1 text-sm leading-6 text-ink/60">Optional signal only. Closed roles can help tune the next pass without turning the search into a scoreboard.</p>
      </div>
    </div>
    {lowData && !insights?.insights?.length && <div className="mt-4 rounded-2xl bg-cream p-4 text-sm font-bold text-ink/60">Not enough closed-role history yet. Log outcomes when it feels useful, and CareerGroove will wait for real patterns before naming them.</div>}
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      {insights?.insights?.map((insight) => <article key={insight.id} className="rounded-2xl bg-cream p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-plum">{insight.kind} · {insight.confidence} confidence</p>
            <h4 className="mt-1 font-black">{insight.title}</h4>
          </div>
          {insight.state === "later" && <span className="rounded-full bg-sun/70 px-2 py-1 text-[10px] font-black">Later</span>}
        </div>
        <p className="mt-2 text-sm leading-6 text-ink/65">{insight.copy}</p>
        <div className="mt-3 space-y-1">{insight.evidence.map((item) => <p key={item} className="text-xs font-bold text-ink/55">{item}</p>)}</div>
        <p className="mt-3 rounded-xl bg-white/70 p-3 text-sm font-bold text-ink/70">{insight.suggestion}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => void updateInsight(insight.id, "later")} className="rounded-full bg-white px-3 py-1.5 text-xs font-black">Save for later</button>
          <button onClick={() => void updateInsight(insight.id, "dismissed")} className="rounded-full bg-white px-3 py-1.5 text-xs font-black">Dismiss</button>
        </div>
      </article>)}
    </div>
  </section>;
}

function OfferWorkflowCard({
  application,
  offerForm,
  setOfferForm,
  saveOffer,
  quickOfferDecision,
  preferences,
  offerOutcomes,
  accepted,
  conversionDraft,
  setConversionDraft,
  stageConversion,
  confirmConversion,
  conversionNotice,
  converted,
}: {
  application: Application;
  offerForm: Record<string, string>;
  setOfferForm: (value: any) => void;
  saveOffer: (event?: FormEvent) => Promise<void>;
  quickOfferDecision: (outcome: "accepted" | "declined") => Promise<void>;
  preferences: JobPreferences | null;
  offerOutcomes: ApplicationOutcome[];
  accepted: boolean;
  conversionDraft: Record<string, string>;
  setConversionDraft: (value: any) => void;
  stageConversion: () => Promise<void>;
  confirmConversion: () => Promise<void>;
  conversionNotice: string;
  converted: boolean;
}) {
  const salary = Number(offerForm.salary || 0) || null;
  const remotePolicy = offerForm.remotePolicy || "";
  const location = offerForm.location || "";
  const schedule = offerForm.schedule || "";
  const decisionDeadline = offerForm.decisionDeadline || "";
  const pros: string[] = [];
  const concerns: string[] = [];
  if (salary && preferences?.salaryTarget && salary >= preferences.salaryTarget) pros.push("Salary meets or beats your saved target.");
  if (salary && preferences?.salaryTarget && salary < preferences.salaryTarget) concerns.push("Salary is below your saved target.");
  if (remotePolicy && preferences?.workModes?.length && preferences.workModes.some((mode) => remotePolicy.toLowerCase().includes(mode))) pros.push("Remote policy lines up with your preferred work mode.");
  if (location && preferences?.locationPreference && location.toLowerCase().includes(preferences.locationPreference.toLowerCase())) pros.push("Location matches your saved preference.");
  if (decisionDeadline) concerns.push(`Decision deadline: ${decisionDeadline}`);
  if (!pros.length) pros.push("Record the offer details here so CareerGroove can compare them against your preferences.");
  if (!concerns.length) concerns.push("No clear concerns surfaced from your saved preferences yet.");

  const checklist = [
    { label: "Base salary recorded", done: Boolean(offerForm.salary) },
    { label: "Benefits notes captured", done: Boolean(offerForm.benefitsNotes) },
    { label: "Remote policy and schedule clear", done: Boolean(offerForm.remotePolicy && offerForm.schedule) },
    { label: "Decision deadline saved", done: Boolean(offerForm.decisionDeadline) },
    { label: "Negotiation status named", done: Boolean(offerForm.negotiationStatus) },
  ];

  return <section className="grid scroll-mt-6 gap-5 xl:grid-cols-[1.1fr_.9fr]" id="application-section-offer">
    <form onSubmit={(event) => void saveOffer(event)} className="rounded-3xl border-2 border-ink bg-white p-5 shadow-[0_5px_0_#26312c]">
      <p className="text-xs font-black uppercase tracking-[.18em] text-plum">Offer Workflow</p>
      <h3 className="font-[var(--font-display)] text-xl font-black">Decision room</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <OfferInput label="Salary" value={offerForm.salary} onChange={(salary) => setOfferForm({ ...offerForm, salary })} />
        <OfferInput label="Bonus" value={offerForm.bonus} onChange={(bonus) => setOfferForm({ ...offerForm, bonus })} />
        <OfferInput label="Location" value={offerForm.location} onChange={(locationValue) => setOfferForm({ ...offerForm, location: locationValue })} />
        <OfferInput label="Schedule" value={offerForm.schedule} onChange={(scheduleValue) => setOfferForm({ ...offerForm, schedule: scheduleValue })} />
        <OfferInput label="Remote policy" value={offerForm.remotePolicy} onChange={(remotePolicyValue) => setOfferForm({ ...offerForm, remotePolicy: remotePolicyValue })} />
        <OfferInput label="Negotiation status" value={offerForm.negotiationStatus} onChange={(negotiationStatus) => setOfferForm({ ...offerForm, negotiationStatus })} />
        <OfferInput label="Start date" value={offerForm.startDate} onChange={(startDate) => setOfferForm({ ...offerForm, startDate })} type="date" />
        <OfferInput label="Decision deadline" value={offerForm.decisionDeadline} onChange={(deadline) => setOfferForm({ ...offerForm, decisionDeadline: deadline })} type="date" />
        <label className="sm:col-span-2 block text-xs font-black uppercase tracking-[.18em] text-plum">Benefits notes
          <textarea value={offerForm.benefitsNotes} onChange={(event) => setOfferForm({ ...offerForm, benefitsNotes: event.target.value })} className="mt-2 min-h-24 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold normal-case outline-none" />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="rounded-2xl border-2 border-ink bg-mint px-4 py-2.5 text-sm font-black">Save offer</button>
        <button type="button" onClick={() => void quickOfferDecision("accepted")} className="rounded-2xl border-2 border-ink bg-sun px-4 py-2.5 text-sm font-black">Accept helper</button>
        <button type="button" onClick={() => void quickOfferDecision("declined")} className="rounded-2xl border-2 border-ink bg-white px-4 py-2.5 text-sm font-black">Decline helper</button>
      </div>
    </form>
    <div className="space-y-5">
      <div className="rounded-3xl border-2 border-ink/15 bg-white/70 p-5">
        <h3 className="font-[var(--font-display)] text-xl font-black">Offer comparison</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <DetailCard label="Salary" value={salary ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(salary) : "Not recorded"} />
        <DetailCard label="Remote policy" value={remotePolicy || "Not recorded"} />
        <DetailCard label="Schedule" value={schedule || "Not recorded"} />
        <DetailCard label="Deadline" value={decisionDeadline || "Not recorded"} />
      </div>
      </div>
      {offerOutcomes.length > 1 && <div className="rounded-3xl border-2 border-ink/15 bg-white/70 p-5">
        <h3 className="font-[var(--font-display)] text-xl font-black">Offer history</h3>
        <div className="mt-4 space-y-3">
          {offerOutcomes.map((outcome) => {
            const offer = readRecord(outcome.offer);
            const rowSalary = Number(offer.salary || 0) || null;
            return <div key={outcome.id} className="rounded-2xl bg-cream p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-black">{titleCase(outcome.outcome)} · {formatDate(outcome.occurredAt)}</p>
                {rowSalary && <span className="rounded-full bg-white px-2 py-1 text-xs font-black">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(rowSalary)}</span>}
              </div>
              <p className="mt-2 text-sm font-bold text-ink/65">{stringValue(offer.negotiationStatus) || outcome.reason || "Offer details logged."}</p>
            </div>;
          })}
        </div>
      </div>}
      <div className="rounded-3xl border-2 border-ink/15 bg-white/70 p-5">
        <h3 className="font-[var(--font-display)] text-xl font-black">Negotiation checklist</h3>
        <div className="mt-4 space-y-2">{checklist.map((item) => <ChecklistItem key={item.label} done={item.done} label={item.label} />)}</div>
      </div>
      <div className="rounded-3xl border-2 border-ink/15 bg-white/70 p-5">
        <h3 className="font-[var(--font-display)] text-xl font-black">Decision clarity</h3>
      <div className="mt-4 rounded-2xl bg-cream p-4">
        <p className="text-xs font-black uppercase tracking-[.18em] text-plum">Pros</p>
        <div className="mt-3 space-y-2">{pros.map((item) => <p key={item} className="text-sm font-bold text-ink/70">{item}</p>)}</div>
      </div>
      <div className="mt-4 rounded-2xl bg-cream p-4">
        <p className="text-xs font-black uppercase tracking-[.18em] text-plum">Concerns and questions</p>
        <div className="mt-3 space-y-2">{concerns.map((item) => <p key={item} className="text-sm font-bold text-ink/70">{item}</p>)}</div>
      </div>
    </div>
      {accepted && <div className="rounded-3xl border-2 border-ink/15 bg-mint/20 p-5">
        <h3 className="font-[var(--font-display)] text-xl font-black">Future Journey chapter</h3>
        {converted ? <p className="mt-2 text-sm font-bold text-ink/65">This accepted role already has a Journey seed.</p> : <>
          <p className="mt-2 text-sm leading-6 text-ink/65">Nothing is created automatically. Review the draft and confirm when this should become a future work chapter.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <OfferInput label="Title" value={conversionDraft.title} onChange={(title) => setConversionDraft({ ...conversionDraft, title })} />
            <OfferInput label="Company" value={conversionDraft.company} onChange={(company) => setConversionDraft({ ...conversionDraft, company })} />
            <OfferInput label="Location" value={conversionDraft.location} onChange={(nextLocation) => setConversionDraft({ ...conversionDraft, location: nextLocation })} />
            <OfferInput label="Start date" value={conversionDraft.startedOn} onChange={(startedOn) => setConversionDraft({ ...conversionDraft, startedOn })} type="date" />
          </div>
          <textarea value={conversionDraft.rawNotes} onChange={(event) => setConversionDraft({ ...conversionDraft, rawNotes: event.target.value })} className="mt-3 min-h-20 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none" />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void stageConversion()} className="rounded-2xl border-2 border-ink bg-white px-4 py-2.5 text-sm font-black">Stage draft</button>
            <button type="button" onClick={() => void confirmConversion()} className="rounded-2xl border-2 border-ink bg-sun px-4 py-2.5 text-sm font-black">Confirm Journey seed</button>
          </div>
          {conversionNotice && <p className="mt-3 rounded-2xl bg-white/80 p-3 text-sm font-bold">{conversionNotice}</p>}
        </>}
      </div>}
    </div>
  </section>;
}

function OfferInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block text-xs font-black uppercase tracking-[.18em] text-plum">{label}
    <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold normal-case outline-none" />
  </label>;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown) {
  if (typeof value === "number") return String(value);
  return typeof value === "string" ? value : "";
}

function answersToText(value: unknown) {
  const answers = arrayValue(value);
  return answers.map((entry) => {
    const item = readRecord(entry);
    return [
      `Q: ${stringValue(item.question)}`,
      `A: ${stringValue(item.answer)}`,
      item.source ? `Source: ${stringValue(item.source)}` : "",
      item.confidence ? `Confidence: ${stringValue(item.confidence)}` : "",
      item.kind ? `Kind: ${stringValue(item.kind)}` : "",
    ].filter(Boolean).join("\n");
  }).join("\n\n");
}

function parseAnswersText(value: string) {
  const blocks = value.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  return blocks.map((block) => {
    const lines = block.split("\n");
    const read = (label: string) => {
      const line = lines.find((item) => item.toLowerCase().startsWith(`${label.toLowerCase()}:`));
      return line ? line.slice(label.length + 1).trim() : "";
    };
    const question = read("Q") || lines[0]?.trim() || "";
    const answer = read("A") || lines.slice(1).join("\n").trim();
    const confidence = read("Confidence").toLowerCase();
    const kind = read("Kind").toLowerCase().replace(/\s+/g, "_");
    return {
      question,
      answer,
      source: read("Source") || undefined,
      confidence: confidence === "low" || confidence === "high" ? confidence : "medium",
      kind: kind === "standard_profile" ? "standard_profile" : "job_specific",
    };
  }).filter((item) => item.question && item.answer);
}

function normalizeOfferPayload(offer: Record<string, string>) {
  return {
    salary: offer.salary ? Number(offer.salary) : null,
    bonus: offer.bonus ? Number(offer.bonus) : null,
    benefitsNotes: offer.benefitsNotes || null,
    location: offer.location || null,
    schedule: offer.schedule || null,
    remotePolicy: offer.remotePolicy || null,
    startDate: offer.startDate || null,
    decisionDeadline: offer.decisionDeadline || null,
    negotiationStatus: offer.negotiationStatus || null,
  };
}
