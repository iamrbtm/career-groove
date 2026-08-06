"use client";

import { useState } from "react";
import { Eye, FileDown, FileText, LoaderCircle, Sparkles, X } from "lucide-react";

type Score = {
  fit?: number; readiness?: number; desire?: number;
  leverage?: number; risk?: number; timing?: number;
  label?: string; reasons?: string[]; gaps?: string[];
};

type Document = {
  id: string;
  kind: string;
  title: string | null;
  status: string;
  text?: string | null;
  targetJob?: { title?: string; company?: string };
};
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
  const [downloadingId, setDownloadingId] = useState("");
  const [notice, setNotice] = useState("");
  const [previewId, setPreviewId] = useState("");

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

  async function downloadDocument(document: Document) {
    setDownloadingId(document.id);
    setNotice("");
    try {
      const response = await fetch(`/api/applications/${applicationId}/documents/${document.id}/pdf`);
      const data = response.ok ? null : await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "The PDF could not be created.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = `${cleanFileName(document.title || documentLabel(document.kind))}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "The PDF could not be created.");
    } finally {
      setDownloadingId("");
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
              <div
                key={doc.id}
                onMouseEnter={() => setPreviewId(doc.id)}
                onMouseLeave={() => setPreviewId((current) => current === doc.id ? "" : current)}
                className="rounded-2xl border border-ink/10 bg-white/85 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[.18em] text-plum">{documentLabel(doc.kind)}</p>
                    <p className="mt-1 flex items-center gap-2 text-sm font-black text-ink">
                      <FileText size={14} />
                      <span className="truncate">{doc.title || documentLabel(doc.kind)}</span>
                    </p>
                    {(doc.targetJob?.company || doc.targetJob?.title) && (
                      <p className="mt-1 text-xs font-bold text-ink/55">
                        {[doc.targetJob?.company, doc.targetJob?.title].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[.14em] ${
                      doc.status === "submitted" ? "bg-mint" : doc.status === "generated" ? "bg-sun/70" : "bg-ink/10"
                    }`}>{doc.status}</span>
                    <button
                      type="button"
                      onClick={() => setPreviewId((current) => current === doc.id ? "" : doc.id)}
                      className="rounded-xl bg-ink/5 p-2 text-ink md:hidden"
                      aria-label={`Preview ${documentLabel(doc.kind)}`}
                    >
                      {previewId === doc.id ? <X size={16} /> : <Eye size={16} />}
                    </button>
                    <button
                      type="button"
                      disabled={downloadingId === doc.id}
                      onClick={() => void downloadDocument(doc)}
                      className="rounded-xl bg-sun p-2 text-ink disabled:opacity-60"
                      aria-label={`Download ${documentLabel(doc.kind)} PDF`}
                    >
                      {downloadingId === doc.id ? <LoaderCircle size={16} className="animate-spin" /> : <FileDown size={16} />}
                    </button>
                  </div>
                </div>

                {previewId === doc.id && (
                  <div className="mt-3 rounded-2xl bg-cream p-3 md:hidden">
                    <p className="text-[10px] font-black uppercase tracking-[.18em] text-plum">Preview</p>
                    <StyledPreview document={doc} />
                  </div>
                )}

                {previewId === doc.id && (
                  <div className="mt-3 hidden rounded-2xl bg-cream p-3 md:block">
                    <p className="text-[10px] font-black uppercase tracking-[.18em] text-plum">Hover preview</p>
                    <StyledPreview document={doc} />
                  </div>
                )}
              </div>
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

function documentLabel(kind: string) {
  if (kind === "cover_letter") return "Cover Letter";
  if (kind === "resume") return "Resume";
  return kind.replace("_", " ");
}

function cleanFileName(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "career-groove-document";
}

function StyledPreview({ document }: { document: Document }) {
  if (!document.text?.trim()) {
    return <p className="mt-2 text-sm leading-6 text-ink/75">Preview unavailable for this document.</p>;
  }

  if (document.kind === "cover_letter") {
    const preview = parseCoverLetterPreview(document.text);
    return (
      <div className="mt-2 max-h-80 overflow-y-auto rounded-2xl border border-ink/10 bg-white p-4 text-ink shadow-[0_2px_0_rgba(38,49,44,0.08)]">
        <div className="border-b border-ink/10 pb-3">
          <div className="mb-2 flex gap-1.5">
            <span className="block h-2.5 w-2.5 rounded-sm bg-sun" />
            <span className="block h-2.5 w-2.5 rounded-sm bg-coral" />
            <span className="block h-2.5 w-2.5 rounded-sm bg-sky" />
          </div>
          <p className="text-sm font-black">Cover Letter</p>
          <p className="mt-1 text-xs font-bold text-ink/55">{new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date())}</p>
          {(document.targetJob?.company || document.targetJob?.title) && (
            <p className="mt-1 text-xs font-bold text-ink/55">{[document.targetJob?.company, document.targetJob?.title].filter(Boolean).join(" · ")}</p>
          )}
        </div>
        <div className="space-y-3 pt-3 text-sm leading-6">
          <p className="font-bold">{preview.greeting}</p>
          {preview.body.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
          <div className="pt-2">
            <p>{preview.closing}</p>
            <div className="mt-3 h-8 w-24 rounded bg-ink/5" />
            <p className="mt-2 font-bold">Signature on PDF</p>
          </div>
        </div>
      </div>
    );
  }

  const lines = document.text.split("\n").map((line) => line.trimEnd()).filter((line, index, all) => line || (index > 0 && all[index - 1]));
  return (
    <div className="mt-2 max-h-80 overflow-y-auto rounded-2xl border border-ink/10 bg-white p-4 text-ink shadow-[0_2px_0_rgba(38,49,44,0.08)]">
      <div className="border-b border-ink/10 pb-3">
        <div className="mb-2 flex gap-1.5">
          <span className="block h-2.5 w-2.5 rounded-sm bg-sun" />
          <span className="block h-2.5 w-2.5 rounded-sm bg-coral" />
          <span className="block h-2.5 w-2.5 rounded-sm bg-sky" />
        </div>
        <p className="text-sm font-black">Resume</p>
      </div>
      <div className="pt-3 font-mono text-[12px] leading-5 text-ink/80">
        {lines.map((line, index) => (
          <p key={index} className={/^[A-Z][A-Z\s]+$/.test(line) ? "mt-2 font-sans text-[11px] font-black uppercase tracking-[.16em] text-plum" : ""}>
            {line || "\u00A0"}
          </p>
        ))}
      </div>
    </div>
  );
}

function parseCoverLetterPreview(text: string) {
  const paragraphs = text
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
  const greeting = /^dear\b/i.test(paragraphs[0] || "") ? paragraphs[0] : "Dear Hiring Manager,";
  let body = /^dear\b/i.test(paragraphs[0] || "") ? paragraphs.slice(1) : paragraphs;
  let closing = "Sincerely,";
  const last = body.at(-1);
  if (last && /^(sincerely|best regards|kind regards|regards|thank you|respectfully)[,!]?\s*$/i.test(last)) {
    closing = last;
    body = body.slice(0, -1);
  }
  return {
    greeting,
    body: body.length ? body : ["Preview unavailable."],
    closing,
  };
}

function ScorePill({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-2xl border-2 border-ink/10 bg-white px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[.18em] text-plum">{label}</p>
      <p className="mt-1 font-black">{typeof value === "number" ? `${value}/100` : "Not scored"}</p>
    </div>
  );
}
