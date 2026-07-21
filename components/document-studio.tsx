"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { FileDown, FileText, LoaderCircle, Sparkles } from "lucide-react";
import { AppShell, PageHeading } from "./app-shell";

type Kind = "resume" | "cover_letter" | "both";
type GenerationJob = {
  id: string;
  kind: Kind;
  targetJob: { title: string; company: string; description: string };
  status: "queued" | "processing" | "completed" | "failed";
  result: Partial<Record<"resume" | "cover_letter", string>>;
  error?: string;
  createdAt: string;
};

const kindLabels: Record<Kind, string> = { resume: "Resume", cover_letter: "Cover letter", both: "Both" };

export function DocumentStudio() {
  const [kind, setKind] = useState<Kind>("resume");
  const [targetTitle, setTargetTitle] = useState("");
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [selectedResult, setSelectedResult] = useState<"resume" | "cover_letter">("resume");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/document-jobs", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setJobs(data.jobs || []);
    setSelectedId((current) => current || data.jobs?.[0]?.id);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!jobs.some((job) => job.status === "queued" || job.status === "processing")) return;
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(timer);
  }, [jobs, refresh]);

  const selected = jobs.find((job) => job.id === selectedId);
  const availableResults = useMemo(() => selected ? Object.keys(selected.result || {}) as ("resume" | "cover_letter")[] : [], [selected]);
  useEffect(() => {
    if (availableResults.length && !availableResults.includes(selectedResult)) setSelectedResult(availableResults[0]);
  }, [availableResults, selectedResult]);

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

  function download(text: string, resultKind: "resume" | "cover_letter") {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selected?.targetJob.title || "career-groove"}-${resultKind}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
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
          <div className="mt-3 space-y-2">{jobs.length ? jobs.map((job) =>
            <button key={job.id} onClick={() => setSelectedId(job.id)} className={`w-full rounded-2xl border-2 p-3 text-left ${selectedId === job.id ? "border-plum bg-lilac/20" : "border-ink/10"}`}>
              <span className="block text-sm font-black">{job.targetJob.title} · {job.targetJob.company}</span>
              <span className="mt-1 block text-xs font-bold text-ink/55">{kindLabels[job.kind]} · {statusLabel(job.status)}</span>
            </button>) : <p className="py-4 text-center text-sm font-bold text-ink/40">No drafts queued yet.</p>}</div>
        </section>
      </div>
      <section className="min-h-[560px] rounded-3xl border-2 border-ink bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-[var(--font-display)] text-xl font-black"><FileText />Draft</h2>
          {availableResults.length > 1 && <div className="flex gap-2">{availableResults.map((value) => <button key={value} onClick={() => setSelectedResult(value)} className={`rounded-xl px-3 py-2 text-xs font-black ${selectedResult === value ? "bg-sun" : "bg-ink/5"}`}>{kindLabels[value]}</button>)}</div>}
          {output && <button onClick={() => download(output, selectedResult)} className="rounded-xl bg-sun p-2" title="Download"><FileDown size={18} /></button>}
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

function Field({ label, value, set }: { label: string; value: string; set: (value: string) => void }) {
  return <label className="mt-4 block text-xs font-black uppercase tracking-wider text-plum">{label}<input required value={value} onChange={(event) => set(event.target.value)} className="mt-1 w-full rounded-2xl border-2 border-ink/15 px-3 py-2.5 text-sm font-bold normal-case outline-none focus:border-coral" /></label>;
}
