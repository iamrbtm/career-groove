"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Archive, FileDown, FileText, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { AppShell, PageHeading } from "./app-shell";

type Kind = "resume" | "cover_letter" | "both";
type GenerationJob = {
  id: string;
  kind: Kind;
  targetJob: { title: string; company: string; description: string };
  status: "queued" | "processing" | "completed" | "failed";
  result: {
    resume?: string;
    cover_letter?: string;
    resumeData?: unknown;
  };
  error?: string;
  createdAt: string;
  archivedAt?: string | null;
};

const kindLabels: Record<Kind, string> = { resume: "Resume", cover_letter: "Cover Letter", both: "Both" };
const draftKindOrder = ["cover_letter", "resume", "both"] as const;

export function DocumentStudio() {
  const [kind, setKind] = useState<Kind>("resume");
  const [targetTitle, setTargetTitle] = useState("");
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [selectedResult, setSelectedResult] = useState<"resume" | "cover_letter">("resume");
  const [submitting, setSubmitting] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string>();
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/document-jobs", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    const nextJobs = data.jobs || [];
    setJobs(nextJobs);
    setSelectedId((current) => current && nextJobs.some((job: GenerationJob) => job.id === current) ? current : nextJobs[0]?.id);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!jobs.some((job) => job.status === "queued" || job.status === "processing")) return;
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(timer);
  }, [jobs, refresh]);

  const selected = jobs.find((job) => job.id === selectedId);
  const availableResults = useMemo(() => selected
    ? (["resume", "cover_letter"] as const).filter((value) => Boolean(selected.result?.[value]))
    : [], [selected]);
  useEffect(() => {
    if (availableResults.length && !availableResults.includes(selectedResult)) setSelectedResult(availableResults[0]);
  }, [availableResults, selectedResult]);

  const groupedJobs = useMemo(() => {
    const groups = new Map<string, { title: string; jobs: GenerationJob[] }>();
    for (const job of jobs) {
      const title = cleanLabel(job.targetJob.title, "Untitled role");
      const key = title.toLowerCase();
      const group = groups.get(key) || { title, jobs: [] };
      group.jobs.push(job);
      groups.set(key, group);
    }
    return Array.from(groups.values());
  }, [jobs]);

  async function generate(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setNotice("");
    try {
      const response = await fetch("/api/document-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, target: { title: targetTitle, company, description } }),
      });
      const data = await response.json();
      if (response.status === 401) throw new Error("Sign in to generate documents from your private career history.");
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "The draft could not be queued.");
      setJobs((current) => [data.job, ...current]);
      setSelectedId(data.job.id);
      setSelectedResult(kind === "cover_letter" ? "cover_letter" : "resume");
      setNotice("Draft queued. You can leave this page and come back later.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The draft could not be queued.");
    } finally { setSubmitting(false); }
  }

  async function download(text: string, resultKind: "resume" | "cover_letter") {
    if (resultKind === "resume" && selected) {
      setNotice("");
      const response = await fetch(`/api/document-jobs/${selected.id}/resume`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setNotice(typeof data.error === "string" ? data.error : "The PDF could not be created.");
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${selected.targetJob.title || "career-groove"}-resume.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      return;
    }
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selected?.targetJob.title || "career-groove"}-${resultKind}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function reprocess(job: GenerationJob) {
    setPendingActionId(job.id);
    setNotice("");
    try {
      const response = await fetch(`/api/document-jobs/${job.id}/reprocess`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "The draft could not be reprocessed.");
      setJobs((current) => [data.job, ...current]);
      setSelectedId(data.job.id);
      setSelectedResult(data.job.kind === "cover_letter" ? "cover_letter" : "resume");
      setNotice("Draft queued for reprocessing.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The draft could not be reprocessed.");
    } finally { setPendingActionId(undefined); }
  }

  async function archiveJob(job: GenerationJob) {
    setPendingActionId(job.id);
    setNotice("");
    try {
      const response = await fetch(`/api/document-jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "The draft could not be archived.");
      const nextJobs = jobs.filter((item) => item.id !== job.id);
      setJobs(nextJobs);
      if (selectedId === job.id) setSelectedId(nextJobs[0]?.id);
      setNotice("Draft archived.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The draft could not be archived.");
    } finally { setPendingActionId(undefined); }
  }

  const output = selected?.result?.[selectedResult] || "";
  return <AppShell>
    <PageHeading eyebrow="Document studio" title="Make your next move sing." copy="Queue tailored resumes and cover letters, then keep moving while CareerGroove writes them in the background." />
    <div className="mt-7 grid gap-6 lg:grid-cols-[.72fr_1.28fr]">
      <div className="space-y-5">
        <form onSubmit={generate} className="rounded-3xl border-2 border-ink bg-white p-5 shadow-[0_5px_0_#26312c]">
          <div className="grid grid-cols-3 gap-2">{(["resume", "cover_letter", "both"] as const).map((value) =>
            <button type="button" onClick={() => setKind(value)} key={value} className={`rounded-2xl border-2 border-ink px-2 py-2 text-sm font-black ${kind === value ? "bg-sun" : "bg-white"}`}>{kindLabels[value]}</button>)}</div>
          <Field label="Target title" value={targetTitle} set={setTargetTitle} />
          <Field label="Company" value={company} set={setCompany} />
          <label className="mt-4 block text-xs font-black uppercase tracking-wider text-plum">Job description
            <textarea required value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 min-h-40 w-full rounded-2xl border-2 border-ink/15 p-3 text-sm font-normal normal-case outline-none focus:border-coral" />
          </label>
          <button disabled={submitting} className="mt-4 flex w-full justify-center gap-2 rounded-2xl border-2 border-ink bg-coral py-3 font-black shadow-[0_4px_0_#26312c] disabled:opacity-60">
            {submitting ? <LoaderCircle className="animate-spin" /> : <Sparkles />}{submitting ? "Queuing…" : "Generate draft"}
          </button>
          {notice && <p className="mt-4 rounded-xl bg-mint/25 p-3 text-sm font-bold">{notice}</p>}
        </form>
        <section className="rounded-3xl border-2 border-ink bg-white p-4">
          <h2 className="font-[var(--font-display)] text-lg font-black">Recent drafts</h2>
          <div className="mt-3 space-y-4">{groupedJobs.length ? groupedJobs.map((group) =>
            <div key={group.title} className="rounded-2xl border-2 border-ink/10 bg-cream/40 p-3">
              <h3 className="font-[var(--font-display)] text-base font-black leading-tight">{group.title}</h3>
              <div className="mt-3 space-y-3">{draftKindOrder.map((groupKind) => {
                const records = group.jobs.filter((job) => job.kind === groupKind);
                if (!records.length) return null;
                return <div key={groupKind}>
                  <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-plum">{kindLabels[groupKind]}</p>
                  <div className="space-y-2">{records.map((job) =>
                    <div key={job.id} className={`flex items-center gap-2 rounded-2xl border-2 bg-white p-2 ${selectedId === job.id ? "border-plum shadow-[0_3px_0_#7b3f98]" : "border-ink/10"}`}>
                      <button type="button" onClick={() => setSelectedId(job.id)} className="min-w-0 flex-1 rounded-xl px-2 py-1.5 text-left hover:bg-lilac/15">
                        <span className="block truncate text-sm font-black">{cleanLabel(job.targetJob.company, "No company")}</span>
                        <span className="mt-1 block text-xs font-bold text-ink/55">{statusLabel(job.status)} · {formatDraftDate(job.createdAt)}</span>
                      </button>
                      <button type="button" disabled={pendingActionId === job.id} onClick={() => void reprocess(job)} className="rounded-xl bg-mint/35 p-2 text-ink hover:bg-mint disabled:opacity-50" title="Reprocess draft" aria-label={`Reprocess ${kindLabels[job.kind]} draft for ${group.title}`}>
                        {pendingActionId === job.id ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                      </button>
                      <button type="button" disabled={pendingActionId === job.id} onClick={() => void archiveJob(job)} className="rounded-xl bg-ink/5 p-2 text-ink hover:bg-coral/20 disabled:opacity-50" title="Archive draft" aria-label={`Archive ${kindLabels[job.kind]} draft for ${group.title}`}>
                        <Archive size={16} />
                      </button>
                    </div>)}</div>
                </div>;
              })}</div>
            </div>) : <p className="py-4 text-center text-sm font-bold text-ink/40">No drafts queued yet.</p>}</div>
        </section>
      </div>
      <section className="min-h-[560px] rounded-3xl border-2 border-ink bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-[var(--font-display)] text-xl font-black"><FileText />Draft</h2>
          {availableResults.length > 1 && <div className="flex gap-2">{availableResults.map((value) => <button key={value} onClick={() => setSelectedResult(value)} className={`rounded-xl px-3 py-2 text-xs font-black ${selectedResult === value ? "bg-sun" : "bg-ink/5"}`}>{kindLabels[value]}</button>)}</div>}
          {output && <button onClick={() => void download(output, selectedResult)} className="rounded-xl bg-sun p-2" title={selectedResult === "resume" ? "Download one-page PDF" : "Download text file"}><FileDown size={18} /></button>}
        </div>
        {output ? <pre className="mt-5 whitespace-pre-wrap font-[var(--font-body)] text-sm leading-6">{output}</pre>
          : selected?.status === "failed" ? <div className="mt-5 rounded-2xl bg-coral/15 p-4 text-sm font-bold">{selected.error || "Generation failed. Please try again."}</div>
          : selected ? <div className="grid min-h-[440px] place-items-center text-center"><div><LoaderCircle className="mx-auto animate-spin text-plum" /><p className="mt-3 text-sm font-black">{statusLabel(selected.status)}</p><p className="mt-1 text-xs font-bold text-ink/45">It is safe to leave this page.</p></div></div>
          : <div className="grid min-h-[440px] place-items-center text-center text-sm font-bold text-ink/35">Your tailored draft will land here.</div>}
      </section>
    </div>
  </AppShell>;
}

function statusLabel(status: GenerationJob["status"]) {
  return ({ queued: "Waiting in the queue", processing: "Writing now", completed: "Ready", failed: "Needs attention" })[status];
}

function cleanLabel(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function formatDraftDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function Field({ label, value, set }: { label: string; value: string; set: (value: string) => void }) {
  return <label className="mt-4 block text-xs font-black uppercase tracking-wider text-plum">{label}<input required value={value} onChange={(event) => set(event.target.value)} className="mt-1 w-full rounded-2xl border-2 border-ink/15 px-3 py-2.5 text-sm font-bold normal-case outline-none focus:border-coral" /></label>;
}
