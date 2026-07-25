"use client";

import { BriefcaseBusiness } from "lucide-react";

const stepNames: Record<number, string> = {
  1: "Research", 2: "Documents", 3: "Follow-up",
  4: "Interview", 5: "Decision", 6: "Closed",
};

export function RoleListItem({
  title, company, currentStep, selected, readinessReady, onClick,
}: {
  title: string; company: string; currentStep: number; selected: boolean;
  readinessReady: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl border-2 p-4 text-left transition ${
        selected ? "border-ink bg-mint/30" : "border-ink/10 bg-white hover:border-ink/40"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-plum text-white">
          <BriefcaseBusiness size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-black">{title}</p>
          <p className="truncate text-sm text-ink/55">{company}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className={`size-2 shrink-0 rounded-full ${readinessReady ? "bg-mint" : "bg-coral"}`} />
        <span className="rounded-full bg-cream px-2.5 py-0.5 text-[11px] font-black">
          Step {currentStep}: {stepNames[currentStep] || "Review"}
        </span>
      </div>
    </button>
  );
}
