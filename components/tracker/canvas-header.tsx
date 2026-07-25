"use client";

import { Check, Clock3 } from "lucide-react";

const stepNames: Record<number, string> = {
  1: "Research", 2: "Documents", 3: "Follow-up",
  4: "Interview", 5: "Decision", 6: "Closed",
};

export function CanvasHeader({
  title, company, currentStep, totalSteps, readinessReady,
}: {
  title: string; company: string; currentStep: number; totalSteps: number;
  readinessReady: boolean;
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
