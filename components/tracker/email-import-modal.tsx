"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, CheckCircle2, LoaderCircle, Mail, Minus, Send, X } from "lucide-react";

type ParsedJobEntry = {
  title: string;
  company: string;
  location: string;
  workArrangement: string;
  postingDate: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  whyItMatches: string;
  notableGaps: string;
  applyUrl: string;
  rawText: string;
  confidence: "low" | "medium" | "high";
  description?: string;
  enrichmentSource?: string | null;
};

type ParsedEmailResult = {
  header: string;
  footer: string;
  jobs: ParsedJobEntry[];
  enrichmentStatus: string;
  warnings: string[];
};

type FitScore = {
  entryIndex: number;
  fit: number;
  readiness: number;
  desire: number;
  leverage: number;
  risk: number;
  timing: number;
  label: string;
  reasons: string[];
  gaps: string[];
  nextAction: string;
  nextActionReason: string;
};

type CreatedApplication = {
  id: string;
  title: string;
  company: string;
  latestScore: {
    fit: number;
    label: string;
  } | null;
};

const fitLabels: Record<string, { label: string; bg: string; copy: string }> = {
  apply_first: { label: "Apply first", bg: "bg-mint", copy: "Strong match and you're ready to move on it." },
  research_before_applying: { label: "Research first", bg: "bg-sun/60", copy: "Promising, but needs more signal before you commit." },
  remix_resume_first: { label: "Remix resume first", bg: "bg-sun/60", copy: "Good fit, but your materials need tailoring first." },
  network_first: { label: "Network first", bg: "bg-sky/30", copy: "A referral or contact could open the door here." },
  stretch_role: { label: "Stretch role", bg: "bg-sky/30", copy: "A real stretch — higher risk, possibly still worth it." },
  low_signal_lead: { label: "Low-signal lead", bg: "bg-coral/20", copy: "Thin posting or unclear match. Proceed with care." },
  probably_skip: { label: "Probably skip", bg: "bg-ink/10", copy: "The signals point to passing on this one." },
  follow_up_now: { label: "Follow up now", bg: "bg-mint", copy: "Already applied — time to follow up." },
  prep_mode: { label: "Prep mode", bg: "bg-sky/30", copy: "Already active — focus on prep, not research." },
};

type Step = "paste" | "review" | "creating" | "success";

export function EmailImportModal({ open, onClose, onSaved }: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [step, setStep] = useState<Step>("paste");
  const [emailText, setEmailText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedEmailResult | null>(null);
  const [jobs, setJobs] = useState<ParsedJobEntry[]>([]);
  const [scores, setScores] = useState<Map<number, FitScore>>(new Map());
  const [scoring, setScoring] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedApplication[]>([]);
  const [failed, setFailed] = useState<Array<{ index: number; reason: string }>>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showHeader, setShowHeader] = useState(false);

  if (!open) return null;

  function resetState() {
    setStep("paste");
    setEmailText("");
    setParsedResult(null);
    setJobs([]);
    setScores(new Map());
    setCreated([]);
    setFailed([]);
    setError("");
    setNotice("");
    setShowHeader(false);
  }

  function handleClose() {
    if (step === "creating") return;
    resetState();
    onClose();
  }

  async function handleParse() {
    if (emailText.trim().length < 50) {
      setError("Email text is too short. Please paste the full email.");
      return;
    }
    setParsing(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/applications/parse-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: emailText, enrich: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not parse email.");
      setParsedResult(data);
      setJobs(data.jobs);
      setStep("review");
      await fetchScores(data.jobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not parse email.");
    } finally {
      setParsing(false);
    }
  }

  async function fetchScores(jobList: ParsedJobEntry[]) {
    setScoring(true);
    try {
      const scoreEntries = jobList.map((job) => ({
        title: job.title,
        company: job.company,
        location: job.location || undefined,
        workMode: job.workArrangement !== "unknown" ? job.workArrangement as "remote" | "hybrid" | "onsite" | "flexible" : undefined,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        description: job.description || job.whyItMatches || job.rawText.slice(0, 2000),
        sourceUrl: job.applyUrl || undefined,
      }));
      const res = await fetch("/api/applications/preview-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: scoreEntries }),
      });
      const data = await res.json();
      if (res.ok && data.scores) {
        const scoreMap = new Map<number, FitScore>();
        data.scores.forEach((score: FitScore) => {
          scoreMap.set(score.entryIndex, score);
        });
        setScores(scoreMap);
      }
    } catch {
      // Scores are optional — continue without them
    } finally {
      setScoring(false);
    }
  }

  function updateJob(index: number, field: keyof ParsedJobEntry, value: string) {
    setJobs((prev) => prev.map((job, i) => i === index ? { ...job, [field]: value } : job));
  }

  function removeJob(index: number) {
    setJobs((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreate() {
    setStep("creating");
    setCreating(true);
    setError("");
    try {
      const entries = jobs.map((job) => ({
        title: job.title,
        company: job.company,
        location: job.location || "",
        workMode: job.workArrangement !== "unknown" ? job.workArrangement as "remote" | "hybrid" | "onsite" | "flexible" : "unknown",
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        salaryCurrency: job.salaryCurrency,
        sourceUrl: job.applyUrl || "",
        description: job.description || job.whyItMatches || job.rawText.slice(0, 2000),
        notes: [
          job.whyItMatches ? `Why it matches: ${job.whyItMatches}` : "",
          job.notableGaps ? `Notable gaps: ${job.notableGaps}` : "",
          job.postingDate ? `Posted: ${job.postingDate}` : "",
        ].filter(Boolean).join("\n"),
      }));
      const res = await fetch("/api/applications/bulk-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create applications.");
      setCreated(data.created || []);
      setFailed(data.failed || []);
      setStep("success");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create applications.");
      setStep("review");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border-2 border-ink bg-white p-6 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-coral/20">
              <Mail size={20} className="text-coral" />
            </div>
            <h2 className="font-[var(--font-display)] text-2xl font-black">Paste job email</h2>
          </div>
          <button onClick={handleClose} className="grid size-10 place-items-center rounded-2xl bg-cream hover:bg-coral/20">
            <X size={18} />
          </button>
        </div>

        {error && <p className="mt-4 rounded-2xl border-2 border-coral bg-coral/15 p-3 text-sm font-black">{error}</p>}
        {notice && <p className="mt-4 rounded-2xl bg-mint/20 p-3 text-sm font-bold text-ink/70">{notice}</p>}

        {step === "paste" && (
          <div className="mt-5 space-y-3">
            <textarea
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
              placeholder="Paste your Daily Job Matches email here..."
              className="min-h-48 w-full resize-y rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none"
            />
            <button
              type="button"
              onClick={handleParse}
              disabled={parsing || emailText.trim().length < 50}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-coral px-4 py-3 text-sm font-black shadow-[0_3px_0_#26312c] disabled:opacity-60"
            >
              {parsing ? <LoaderCircle size={17} className="animate-spin" /> : <Mail size={17} />}
              {parsing ? "Parsing..." : "Parse email"}
            </button>
          </div>
        )}

        {step === "review" && (
          <div className="mt-5 space-y-4">
            {parsedResult && parsedResult.warnings.length > 0 && (
              <div className="rounded-2xl border-2 border-sun bg-sun/10 p-3">
                <p className="text-xs font-black uppercase tracking-[.14em] text-plum">
                  {jobs.length} jobs parsed, {parsedResult.warnings.length} warning{parsedResult.warnings.length > 1 ? "s" : ""}
                </p>
                {parsedResult.warnings.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {parsedResult.warnings.map((w, i) => (
                      <li key={i} className="text-xs font-bold text-ink/60">{w}</li>
                    ))}
                  </ul>
                )}
                {parsedResult.enrichmentStatus !== "none" && (
                  <p className="mt-1 text-xs font-bold text-ink/55">
                    Enrichment: {parsedResult.enrichmentStatus}
                  </p>
                )}
              </div>
            )}

            {parsedResult?.header && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowHeader(!showHeader)}
                  className="text-xs font-black uppercase tracking-[.18em] text-plum underline decoration-coral decoration-2 underline-offset-4"
                >
                  {showHeader ? "Hide" : "Show"} email header
                </button>
                {showHeader && (
                  <p className="mt-2 rounded-2xl bg-cream p-3 text-xs font-bold text-ink/60 whitespace-pre-wrap">
                    {parsedResult.header}
                  </p>
                )}
              </div>
            )}

            <p className="text-xs font-black uppercase tracking-[.18em] text-plum">
              {jobs.length} role{jobs.length !== 1 ? "s" : ""} ready to import
            </p>

            {jobs.map((job, index) => {
              const score = scores.get(index);
              const fitColor = score ? (score.fit >= 70 ? "bg-mint" : score.fit >= 45 ? "bg-sun" : "bg-coral") : "bg-ink/10";
              return (
                <div key={index} className="rounded-2xl border-2 border-ink/10 bg-cream p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <input
                        value={job.title}
                        onChange={(e) => updateJob(index, "title", e.target.value)}
                        className="w-full rounded-xl bg-white px-3 py-2 text-sm font-black outline-none"
                      />
                      <input
                        value={job.company}
                        onChange={(e) => updateJob(index, "company", e.target.value)}
                        className="mt-1 w-full rounded-xl bg-white px-3 py-1.5 text-sm font-bold text-ink/70 outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeJob(index)}
                      className="grid size-8 shrink-0 place-items-center rounded-xl bg-coral/20 hover:bg-coral/40"
                    >
                      <Minus size={14} />
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <input
                      value={job.location}
                      onChange={(e) => updateJob(index, "location", e.target.value)}
                      placeholder="Location"
                      className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold outline-none"
                    />
                    <select
                      value={job.workArrangement}
                      onChange={(e) => updateJob(index, "workArrangement", e.target.value)}
                      className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold outline-none"
                    >
                      <option value="unknown">Work mode</option>
                      <option value="remote">Remote</option>
                      <option value="hybrid">Hybrid</option>
                      <option value="onsite">On-site</option>
                      <option value="flexible">Flexible</option>
                    </select>
                  </div>

                  {score && (
                    <div className="mt-3 rounded-xl bg-white p-3">
                      <div className="flex items-center gap-3">
                        <div className={`grid size-12 shrink-0 place-items-center rounded-xl border-2 border-ink text-sm font-black ${fitColor}`}>
                          {score.fit}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black uppercase tracking-[.14em] text-plum">
                            {fitLabels[score.label]?.label || score.label}
                          </p>
                          <div className="mt-1 grid grid-cols-5 gap-1">
                            {(["readiness", "desire", "leverage", "risk", "timing"] as const).map((key) => {
                              const value = score[key];
                              const color = value >= 70 ? "bg-mint" : value >= 45 ? "bg-sun" : "bg-coral";
                              return (
                                <div key={key}>
                                  <div className="h-1 overflow-hidden rounded-full bg-ink/10">
                                    <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
                                  </div>
                                  <p className="mt-0.5 text-center text-[8px] font-black uppercase tracking-wider text-ink/40">{key.slice(0, 3)}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      {score.reasons.length > 0 && (
                        <p className="mt-2 text-[10px] font-bold text-ink/60">
                          {score.reasons[0]}
                        </p>
                      )}
                    </div>
                  )}

                  {job.confidence === "low" && (
                    <p className="mt-2 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-sun">
                      <AlertTriangle size={12} /> Low confidence — please review
                    </p>
                  )}

                  {job.enrichmentSource === null && job.applyUrl && (
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-coral/80">
                      URL not fetched — using email data only
                    </p>
                  )}

                  <div className="mt-2 space-y-1">
                    {job.whyItMatches && (
                      <p className="text-[11px] font-bold leading-4 text-ink/60">
                        <span className="font-black text-plum">Matches:</span> {job.whyItMatches.slice(0, 150)}{job.whyItMatches.length > 150 ? "..." : ""}
                      </p>
                    )}
                    {job.notableGaps && (
                      <p className="text-[11px] font-bold leading-4 text-ink/60">
                        <span className="font-black text-coral">Gaps:</span> {job.notableGaps.slice(0, 150)}{job.notableGaps.length > 150 ? "..." : ""}
                      </p>
                    )}
                  </div>

                  {job.applyUrl && (
                    <a
                      href={job.applyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-[11px] font-black text-plum underline decoration-coral underline-offset-2"
                    >
                      View posting →
                    </a>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={handleCreate}
              disabled={jobs.length === 0 || creating}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-mint px-4 py-3 text-sm font-black shadow-[0_3px_0_#26312c] disabled:opacity-60"
            >
              {scoring ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={17} />}
              {scoring ? "Computing scores..." : `Create ${jobs.length} application${jobs.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        )}

        {step === "creating" && (
          <div className="mt-5 flex flex-col items-center gap-3 py-8">
            <LoaderCircle size={32} className="animate-spin text-coral" />
            <p className="text-sm font-black">Creating applications...</p>
            <p className="text-xs font-bold text-ink/55">This may take a moment while we score each role.</p>
          </div>
        )}

        {step === "success" && (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl bg-mint/15 p-4 text-center">
              <CheckCircle2 size={32} className="mx-auto text-mint" />
              <p className="mt-2 font-[var(--font-display)] text-xl font-black">
                {created.length} application{created.length !== 1 ? "s" : ""} created!
              </p>
              <p className="mt-1 text-sm font-bold text-ink/60">
                {created.length > 1 ? "They're" : "It's"} now in your Tracker Studio with Career DJ fit scores.
              </p>
            </div>

            {created.length > 0 && (
              <div className="space-y-2">
                {created.map((app) => (
                  <div key={app.id} className="flex items-center justify-between rounded-xl bg-cream p-3">
                    <div>
                      <p className="text-sm font-black">{app.title}</p>
                      <p className="text-xs font-bold text-ink/55">{app.company}</p>
                    </div>
                    {app.latestScore && (
                      <div className={`grid size-10 place-items-center rounded-xl border-2 border-ink text-xs font-black ${app.latestScore.fit >= 70 ? "bg-mint" : app.latestScore.fit >= 45 ? "bg-sun" : "bg-coral"}`}>
                        {app.latestScore.fit}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {failed.length > 0 && (
              <div className="rounded-2xl border-2 border-coral bg-coral/10 p-3">
                <p className="text-xs font-black uppercase tracking-[.14em] text-coral">
                  {failed.length} failed
                </p>
                <ul className="mt-2 space-y-1">
                  {failed.map((f, i) => (
                    <li key={i} className="text-xs font-bold text-ink/60">
                      {jobs[f.index]?.title || `Entry ${f.index + 1}`}: {f.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={handleClose}
              className="w-full rounded-2xl border-2 border-ink bg-sun px-4 py-3 text-sm font-black"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
