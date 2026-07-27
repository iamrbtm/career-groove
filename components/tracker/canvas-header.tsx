"use client";

import { Check, Clock3 } from "lucide-react";

const stepNames: Record<number, string> = {
  1: "Research", 2: "Documents", 3: "Follow-up",
  4: "Interview", 5: "Decision", 6: "Closed",
};

const labelDisplay: Record<string, { label: string; bg: string }> = {
  apply_first: { label: "Apply first", bg: "bg-mint" },
  research_before_applying: { label: "Research first", bg: "bg-sun/60" },
  remix_resume_first: { label: "Remix resume first", bg: "bg-sun/60" },
  network_first: { label: "Network first", bg: "bg-sky/30" },
  stretch_role: { label: "Stretch role", bg: "bg-coral/20" },
  low_signal_lead: { label: "Low-signal lead", bg: "bg-coral/20" },
  probably_skip: { label: "Probably skip", bg: "bg-ink/10" },
  follow_up_now: { label: "Follow up now", bg: "bg-mint" },
  prep_mode: { label: "Prep mode", bg: "bg-sky/30" },
};

function ScoreChip({ name, value }: { name: string; value: number }) {
  const barColor = value >= 70 ? "bg-mint" : value >= 45 ? "bg-sun" : "bg-coral";
  return (
    <div className="rounded-xl bg-cream px-2.5 py-1.5">
      <div className="flex items-center gap-1.5 text-xs font-black">
        <span>{name}</span>
        <span className="text-ink/55">{value}</span>
      </div>
      <div className="mt-0.5 h-1.5 w-16 overflow-hidden rounded-full bg-ink/10">
        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function CanvasHeader({
  title, company, currentStep, totalSteps, readinessReady, latestScore,
}: {
  title: string; company: string; currentStep: number; totalSteps: number;
  readinessReady: boolean;
  latestScore?: { label: string; fit?: number; readiness?: number; desire?: number; leverage?: number; risk?: number; timing?: number; reasons?: string[]; gaps?: string[] } | null;
}) {
  return (
    <div className="rounded-3xl border-2 border-ink bg-white p-5 shadow-[0_5px_0_#26312c]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-plum">
            Step {currentStep}: {stepNames[currentStep] || "Review"}
          </p>
          <h2 className="mt-1 break-words font-[var(--font-display)] text-3xl font-black">{title}</h2>
          <p className="mt-1 text-sm font-bold text-ink/55">{company}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {readinessReady ? (
            <span className="flex items-center gap-1 rounded-full bg-mint px-3 py-1 text-xs font-black">
              <Check size={14} /> Ready
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-coral/20 px-3 py-1 text-xs font-black">
              <Clock3 size={14} /> Needs setup
            </span>
          )}
        </div>
      </div>

      {latestScore && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${labelDisplay[latestScore.label]?.bg || "bg-ink/10"}`}>
            {labelDisplay[latestScore.label]?.label || latestScore.label}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {latestScore.fit != null && <ScoreChip name="Fit" value={latestScore.fit} />}
            {latestScore.readiness != null && <ScoreChip name="Readiness" value={latestScore.readiness} />}
            {latestScore.desire != null && <ScoreChip name="Desire" value={latestScore.desire} />}
            {latestScore.leverage != null && <ScoreChip name="Leverage" value={latestScore.leverage} />}
            {latestScore.risk != null && <ScoreChip name="Risk" value={latestScore.risk} />}
            {latestScore.timing != null && <ScoreChip name="Timing" value={latestScore.timing} />}
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <span className="text-xs font-black uppercase tracking-[.18em] text-plum">
          Step {currentStep} of {totalSteps}
        </span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream">
          <div className="h-full rounded-full bg-plum transition-all" style={{ width: `${(currentStep / totalSteps) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
