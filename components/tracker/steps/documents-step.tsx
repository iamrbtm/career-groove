"use client";

import { useState } from "react";
import { FileText, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";

type Score = {
  fit?: number; readiness?: number; desire?: number;
  leverage?: number; risk?: number; timing?: number;
  label?: string; reasons?: string[]; gaps?: string[];
};

type Document = { id: string; kind: string; title: string | null; status: string };
type DocumentJob = { id: string; kind: string; status: string; createdAt: string };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

export function DocumentsStep({
  applicationId, score, documents, documentJobs, onRefresh, onAdvance,
}: {
  applicationId: string; score?: Score | null;
  documents: Document[]; documentJobs: DocumentJob[];
  onRefresh: () => Promise<void>; onAdvance: () => void;
}) {
  const [generating, setGenerating] = useState("");
  const [notice, setNotice] = useState("");

  async function generateDoc(kind: string) {
    setGenerating(kind);
    setNotice("");
    try {
      const res = await fetch("/api/document-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, applicationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not queue draft.");
      setNotice("Draft queued.");
      await onRefresh();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not queue draft.");
    } finally {
      setGenerating("");
    }
  }

  async function refreshRemix() {
    setNotice("");
    try {
      const res = await fetch(`/api/applications/${applicationId}/remix`, { method: "POST" });
      if (!res.ok) throw new Error("Could not refresh.");
      setNotice("Remix summary refreshed.");
      await onRefresh();
    } catch {
      setNotice("Could not refresh remix.");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-ink/60">
        Tailor your resume and cover letter for this role.
      </p>

      {score && (
        <div className="grid gap-2 sm:grid-cols-3">
          <ScorePill label="Fit" value={score.fit} />
          <ScorePill label="Readiness" value={score.readiness} />
          <ScorePill label="Timing" value={score.timing} />
        </div>
      )}

      <div className="rounded-2xl bg-cream p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[.18em] text-plum">Documents</p>
          <button onClick={refreshRemix} className="rounded-full bg-white px-3 py-1.5 text-xs font-black">
            Refresh summary
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {["resume", "cover_letter", "both"].map((kind) => (
            <button
              key={kind}
              disabled={Boolean(generating)}
              onClick={() => generateDoc(kind)}
              className="flex items-center gap-1 rounded-2xl border-2 border-ink bg-sun px-3 py-2 text-xs font-black disabled:opacity-60"
            >
              {generating === kind ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Generate {kind.replace("_", " ")}
            </button>
          ))}
        </div>
        {documents.length > 0 && (
          <div className="mt-3 space-y-2">
            {documents.map((doc) => (
              <p key={doc.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2 text-sm font-bold text-ink/70">
                <span><FileText size={14} className="inline" /> {doc.title || doc.kind.replace("_", " ")}</span>
                <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[.14em] ${
                  doc.status === "submitted" ? "bg-mint" : doc.status === "generated" ? "bg-sun/70" : "bg-ink/10"
                }`}>{doc.status}</span>
              </p>
            ))}
          </div>
        )}
        {documentJobs.length > 0 && (
          <div className="mt-3 space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-plum">Recent drafts</p>
            {documentJobs.slice(0, 3).map((job) => (
              <p key={job.id} className="text-sm font-bold text-ink/55">
                {job.kind.replace("_", " ")} · {formatDate(job.createdAt)} · {job.status}
              </p>
            ))}
          </div>
        )}
      </div>

      <button onClick={onAdvance} className="rounded-2xl border-2 border-ink bg-mint px-4 py-2.5 text-sm font-black">
        Mark documents ready
      </button>

      {notice && <p className="text-sm font-bold text-ink/65">{notice}</p>}
    </div>
  );
}

function ScorePill({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-2xl border-2 border-ink/10 bg-white px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[.18em] text-plum">{label}</p>
      <p className="mt-1 font-black">{typeof value === "number" ? `${value}/100` : "Not scored"}</p>
    </div>
  );
}
