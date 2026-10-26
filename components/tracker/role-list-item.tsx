"use client";

import { motion } from "framer-motion";
import { BriefcaseBusiness } from "lucide-react";

const stepNames: Record<number, string> = {
  1: "Research", 2: "Documents", 3: "Follow-up",
  4: "Interview", 5: "Decision", 6: "Closed",
};

export function RoleListItem({
  title, company, currentStep, selected, readinessReady, onClick, justSaved,
}: {
  title: string; company: string; currentStep: number; selected: boolean;
  readinessReady: boolean; onClick: () => void; justSaved?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      style={{ transformPerspective: 800 }}
      initial={justSaved ? { rotateY: 90, opacity: 0 } : false}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={`w-full rounded-2xl border-2 p-4 text-left transition ${
        selected ? "border-fg bg-mint/30" : "border-edge/10 bg-panel hover:border-edge/40"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-plum text-white">
          <BriefcaseBusiness size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-black">{title}</p>
          <p className="truncate text-sm text-fg/55">{company}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className={`size-2 shrink-0 rounded-full ${readinessReady ? "bg-mint" : "bg-coral"}`} />
        <span className="rounded-full bg-paper px-2.5 py-0.5 text-[11px] font-black">
          Step {currentStep}: {stepNames[currentStep] || "Review"}
        </span>
      </div>
    </motion.button>
  );
}
