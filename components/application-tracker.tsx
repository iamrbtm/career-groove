"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Archive, ArrowRight, BriefcaseBusiness, CalendarClock, Check, ClipboardList, FileText, Plus, RefreshCw, Send, Sparkles } from "lucide-react";
import { AppShell, PageHeading } from "./app-shell";
import { MotionButton } from "./motion-button";
import { applicationStatuses, statusLabels } from "@/lib/application-schema";

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
  createdAt: string;
  updatedAt: string;
  latestScore?: { label: string; reasons: string[]; gaps: string[]; nextAction: string } | null;
};

type ApplicationEvent = {
  id: string;
  eventType: string;
  title: string;
  body: string | null;
  occurredAt: string;
  createdAt: string;
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

function friendlyAction(application: Application) {
  if (application.latestScore?.nextAction) return application.latestScore.nextAction;
  if (application.nextActionReason) return application.nextActionReason;
  if (application.status === "applied" || application.status === "follow_up") return "Check whether a follow-up is due.";
  if (application.status === "interviewing") return "Prep with this role context.";
  if (application.status === "offer") return "Compare the offer against what matters.";
  if (application.status === "rejected") return "Log what happened when you have the energy.";
  return "Decide whether this role deserves document time.";
}

function formatDate(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

export function ApplicationTracker() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [events, setEvents] = useState<ApplicationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
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

  const selected = useMemo(() => applications.find((item) => item.id === selectedId) || applications[0], [applications, selectedId]);

  const refresh = async () => {
    setError("");
    const response = await fetch("/api/applications", { cache: "no-store" });
    if (!response.ok) throw new Error("Applications could not be loaded.");
    const data = await response.json();
    setApplications(data.applications || []);
    if (!selectedId && data.applications?.[0]) setSelectedId(data.applications[0].id);
  };

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof Error ? err.message : "Applications could not be loaded.")).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected?.id) {
      setEvents([]);
      return;
    }
    fetch(`/api/applications/${selected.id}`, { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : { events: [] })
      .then((data) => setEvents(data.events || []))
      .catch(() => setEvents([]));
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
      if (!response.ok) throw new Error("Save failed. Check the required fields.");
      const data = await response.json();
      setCapture({ title: "", company: "", location: "", workMode: "unknown", salaryMin: "", salaryMax: "", sourceUrl: "", description: "", notes: "" });
      await refresh();
      setSelectedId(data.application.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(status: string) {
    if (!selected) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/applications/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Status update failed.");
      await refresh();
      setSelectedId(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveSelected() {
    if (!selected) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/applications/${selected.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Archive failed.");
      setSelectedId("");
      await refresh();
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
    try {
      const response = await fetch(`/api/applications/${selected.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType: "note_added", title: "Note added", body: note }),
      });
      if (!response.ok) throw new Error("Note could not be saved.");
      setNote("");
      const detail = await fetch(`/api/applications/${selected.id}`, { cache: "no-store" }).then((item) => item.json());
      setEvents(detail.events || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Note could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return <AppShell>
    <PageHeading
      eyebrow="Tracker Studio"
      title="Applications"
      copy="Capture roles, keep the next move visible, and let the detailed pipeline sit behind the workflow."
      action={<MotionButton onClick={() => document.getElementById("quick-capture-title")?.focus()} className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-coral px-4 py-3 text-sm font-black shadow-pop"><Plus size={18} /> Paste a job</MotionButton>}
    />

    {error && <p className="mt-5 rounded-2xl border-2 border-coral bg-coral/15 p-3 text-sm font-black">{error}</p>}

    <section className="mt-7 grid gap-5 xl:grid-cols-[420px_1fr]">
      <div className="space-y-5">
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
            <textarea value={capture.notes} onChange={(event) => setCapture({ ...capture, notes: event.target.value })} placeholder="Private notes" className="min-h-20 resize-y rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
            <button disabled={saving} className="flex items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-sun px-4 py-3 text-sm font-black shadow-[0_3px_0_#26312c] disabled:opacity-60"><Send size={17} /> Save opportunity</button>
          </div>
        </form>

        <div className="rounded-3xl border-2 border-ink/15 bg-white/70 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-[var(--font-display)] text-xl font-black">Saved roles</h2>
            <button onClick={() => refresh().catch(() => undefined)} className="grid size-10 place-items-center rounded-2xl bg-cream" title="Refresh"><RefreshCw size={17} /></button>
          </div>
          <div className="mt-4 space-y-3">
            {loading && <p className="rounded-2xl bg-cream p-4 text-sm font-bold text-ink/55">Loading applications...</p>}
            {!loading && !applications.length && <div className="rounded-3xl border-2 border-dashed border-ink/20 bg-cream/70 p-5 text-center">
              <Sparkles className="mx-auto text-coral" />
              <p className="mt-3 font-black">No applications yet.</p>
              <p className="mt-1 text-sm text-ink/55">Paste a job description, or start today's session once you have a role saved.</p>
            </div>}
            {applications.map((application) => <button key={application.id} onClick={() => setSelectedId(application.id)} className={`w-full rounded-2xl border-2 p-4 text-left transition ${selected?.id === application.id ? "border-ink bg-mint/30" : "border-ink/10 bg-white hover:border-ink/40"}`}>
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

      <ApplicationWorkspace application={selected} events={events} note={note} setNote={setNote} addNote={addNote} updateStatus={updateStatus} archiveSelected={archiveSelected} saving={saving} />
    </section>
  </AppShell>;
}

function ApplicationWorkspace({ application, events, note, setNote, addNote, updateStatus, archiveSelected, saving }: {
  application?: Application;
  events: ApplicationEvent[];
  note: string;
  setNote: (value: string) => void;
  addNote: (event: FormEvent) => void;
  updateStatus: (status: string) => void;
  archiveSelected: () => void;
  saving: boolean;
}) {
  if (!application) {
    return <section className="rounded-3xl border-2 border-dashed border-ink/20 bg-white/50 p-8">
      <Sparkles className="text-coral" />
      <h2 className="mt-4 font-[var(--font-display)] text-2xl font-black">Start with one role.</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-ink/60">CareerGroove will keep the next step visible here: apply, research, remix documents, follow up, prep, or log an outcome.</p>
    </section>;
  }

  return <section className="space-y-5">
    <div className="rounded-3xl border-2 border-ink bg-white p-5 shadow-[0_5px_0_#26312c]">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-plum">Next move</p>
          <h2 className="mt-1 break-words font-[var(--font-display)] text-3xl font-black">{application.title}</h2>
          <p className="mt-1 text-sm font-bold text-ink/55">{application.company}{application.location ? ` - ${application.location}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={application.status} disabled={saving} onChange={(event) => updateStatus(event.target.value)} className="rounded-2xl border-2 border-ink bg-cream px-3 py-2 text-sm font-black">
            {statusOptions.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
          </select>
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

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <InfoTile icon={<ClipboardList size={18} />} label="Status" value={statusLabels[application.status as keyof typeof statusLabels]} />
        <InfoTile icon={<CalendarClock size={18} />} label="Saved" value={formatDate(application.createdAt)} />
        <InfoTile icon={<FileText size={18} />} label="Documents" value="Ready to connect" />
      </div>
    </div>

    <div className="grid gap-5 lg:grid-cols-[1fr_.85fr]">
      <div className="rounded-3xl border-2 border-ink/15 bg-white/70 p-5">
        <h3 className="font-[var(--font-display)] text-xl font-black">Job Description</h3>
        <p className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-2xl bg-cream p-4 text-sm leading-6 text-ink/70">{application.description}</p>
        {application.sourceUrl && <a href={application.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-black text-plum underline decoration-coral decoration-2 underline-offset-4">Open source <ArrowRight size={15} /></a>}
      </div>

      <div className="rounded-3xl border-2 border-ink/15 bg-white/70 p-5">
        <h3 className="font-[var(--font-display)] text-xl font-black">Checklist</h3>
        <div className="mt-4 space-y-3 text-sm">
          <ChecklistItem done={Boolean(application.description)} label="Role captured" />
          <ChecklistItem done={Boolean(application.priorityLabel)} label="Career DJ score" />
          <ChecklistItem done={application.status === "applied" || application.status === "follow_up" || application.status === "interviewing" || application.status === "offer"} label="Application submitted" />
          <ChecklistItem done={Boolean(application.followUpDueAt)} label="Follow-up reminder" />
        </div>
      </div>
    </div>

    <div className="grid gap-5 lg:grid-cols-[.85fr_1fr]">
      <form onSubmit={addNote} className="rounded-3xl border-2 border-ink/15 bg-white/70 p-5">
        <h3 className="font-[var(--font-display)] text-xl font-black">Add a note</h3>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="What changed? Who did you talk to? What should future you remember?" className="mt-4 min-h-32 w-full resize-y rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
        <button disabled={saving || !note.trim()} className="mt-3 flex items-center gap-2 rounded-2xl border-2 border-ink bg-sun px-4 py-3 text-sm font-black shadow-[0_3px_0_#26312c] disabled:opacity-60"><Plus size={17} /> Save note</button>
      </form>

      <div className="rounded-3xl border-2 border-ink/15 bg-white/70 p-5">
        <h3 className="font-[var(--font-display)] text-xl font-black">Timeline</h3>
        <div className="mt-4 space-y-3">
          {events.length ? events.map((event) => <div key={event.id} className="rounded-2xl bg-cream p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-black">{event.title}</p>
              <span className="shrink-0 text-xs font-bold text-ink/45">{formatDate(event.occurredAt)}</span>
            </div>
            {event.body && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink/60">{event.body}</p>}
          </div>) : <p className="rounded-2xl bg-cream p-4 text-sm font-bold text-ink/55">Timeline events will appear as you save notes, change status, link documents, and log outcomes.</p>}
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

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return <div className="flex items-center gap-3 rounded-2xl bg-cream p-3">
    <span className={`grid size-6 shrink-0 place-items-center rounded-full border-2 border-ink text-xs font-black ${done ? "bg-mint" : "bg-white"}`}>{done && <Check size={14} />}</span>
    <span className="font-bold">{label}</span>
  </div>;
}
