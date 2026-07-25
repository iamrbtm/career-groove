"use client";

import { ChevronDown, ChevronUp, Check } from "lucide-react";
import type { ReactNode } from "react";

export function StepCard({
  stepNumber, title, isComplete, isCurrent, isExpanded, onToggle, children,
}: {
  stepNumber: number; title: string; isComplete: boolean; isCurrent: boolean;
  isExpanded: boolean; onToggle: () => void; children: ReactNode;
}) {
  return (
    <section className={`rounded-3xl border-2 transition ${
      isCurrent
        ? "border-ink bg-white shadow-[0_5px_0_#26312c]"
        : isComplete
          ? "border-mint/40 bg-white/80"
          : "border-ink/10 bg-white/60"
    }`}>
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 p-5 text-left"
      >
        <div className={`grid size-9 shrink-0 place-items-center rounded-full border-2 border-ink text-xs font-black ${
          isComplete ? "bg-mint" : isCurrent ? "bg-sun" : "bg-white"
        }`}>
          {isComplete ? <Check size={16} /> : stepNumber}
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate font-black">{title}</p>
          {isCurrent && (
            <p className="mt-0.5 text-[10px] font-black uppercase tracking-[.18em] text-plum">Current step</p>
          )}
          {isComplete && (
            <p className="mt-0.5 text-[10px] font-black uppercase tracking-[.18em] text-mint/70">Complete</p>
          )}
        </div>
        {isExpanded ? <ChevronUp size={18} className="shrink-0 text-ink/40" /> : <ChevronDown size={18} className="shrink-0 text-ink/40" />}
      </button>
      {isExpanded && <div className="border-t border-ink/10 px-5 pb-6 pt-4">{children}</div>}
    </section>
  );
}
