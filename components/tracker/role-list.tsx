"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, RefreshCw, Sparkles } from "lucide-react";
import { RoleListItem } from "./role-list-item";
import { buildInitialExpandedSteps, toggleExpandedStep } from "./role-list-expand-state";
import { buildRoleGroups, stepFromStatus } from "./role-list-groups";
import type { TrackerReadiness } from "@/lib/tracker-studio";

type Application = {
  id: string; title: string; company: string;
  currentStep?: number | null; status: string;
  latestScore?: { fit?: number | null } | null;
};

export function RoleList({
  applications, selectedId, onSelect, onRefresh, loading, trackerReadiness, justSavedId,
}: {
  applications: Application[]; selectedId: string; onSelect: (id: string) => void;
  onRefresh: () => void; loading: boolean; trackerReadiness: TrackerReadiness | null;
  justSavedId?: string | null;
}) {
  const groups = buildRoleGroups(applications);
  const [expandedSteps, setExpandedSteps] = useState<number[]>([]);

  useEffect(() => {
    setExpandedSteps((current) => {
      const availableSteps = groups.map((group) => group.step);
      const filtered = current.filter((step) => availableSteps.includes(step));
      if (filtered.length > 0 || current.length > 0) {
        return filtered;
      }
      return buildInitialExpandedSteps(availableSteps);
    });
  }, [groups]);

  return (
    <div className="rounded-3xl border-2 border-edge/15 bg-panel/70 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-[var(--font-display)] text-xl font-black">Saved roles</h2>
        <button onClick={onRefresh} className="grid size-10 place-items-center rounded-2xl bg-paper" title="Refresh">
          <RefreshCw size={17} />
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {loading && <p className="rounded-2xl bg-paper p-4 text-sm font-bold text-fg/55">Loading applications...</p>}
        {!loading && !applications.length && (
          <div className="rounded-3xl border-2 border-dashed border-edge/20 bg-paper/70 p-5 text-center">
            <Sparkles className="mx-auto text-coral" />
            <p className="mt-3 font-black">No applications yet.</p>
            <p className="mt-1 text-sm text-fg/55">Paste a job description and Career Groove will turn it into a clearer next move.</p>
          </div>
        )}
        {groups.map((group) => (
          <section key={group.step} className="space-y-3">
            <button
              type="button"
              onClick={() => setExpandedSteps((current) => toggleExpandedStep(current, group.step))}
              className="flex w-full items-center justify-between rounded-2xl bg-paper/70 px-3 py-2 text-left"
              aria-expanded={expandedSteps.includes(group.step)}
            >
              <h3 className="text-sm font-black uppercase tracking-[0.18em] text-fg/55">{group.title}</h3>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-panel px-2.5 py-1 text-[11px] font-black text-fg/70">
                  {group.applications.length}
                </span>
                {expandedSteps.includes(group.step)
                  ? <ChevronUp size={18} className="shrink-0 text-fg/40" />
                  : <ChevronDown size={18} className="shrink-0 text-fg/40" />}
              </div>
            </button>
            {expandedSteps.includes(group.step) && group.applications.map((app) => (
              <RoleListItem
                key={app.id}
                title={app.title}
                company={app.company}
                currentStep={app.currentStep ?? stepFromStatus(app.status)}
                selected={selectedId === app.id}
                readinessReady={trackerReadiness?.ready ?? false}
                onClick={() => onSelect(app.id)}
                justSaved={justSavedId === app.id}
              />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
