"use client";

import { RefreshCw, Sparkles } from "lucide-react";
import { RoleListItem } from "./role-list-item";
import type { TrackerReadiness } from "@/lib/tracker-studio";

type Application = {
  id: string; title: string; company: string;
  currentStep?: number | null; status: string;
};

export function RoleList({
  applications, selectedId, onSelect, onRefresh, loading, trackerReadiness,
}: {
  applications: Application[]; selectedId: string; onSelect: (id: string) => void;
  onRefresh: () => void; loading: boolean; trackerReadiness: TrackerReadiness | null;
}) {
  return (
    <div className="rounded-3xl border-2 border-ink/15 bg-white/70 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-[var(--font-display)] text-xl font-black">Saved roles</h2>
        <button onClick={onRefresh} className="grid size-10 place-items-center rounded-2xl bg-cream" title="Refresh">
          <RefreshCw size={17} />
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {loading && <p className="rounded-2xl bg-cream p-4 text-sm font-bold text-ink/55">Loading applications...</p>}
        {!loading && !applications.length && (
          <div className="rounded-3xl border-2 border-dashed border-ink/20 bg-cream/70 p-5 text-center">
            <Sparkles className="mx-auto text-coral" />
            <p className="mt-3 font-black">No applications yet.</p>
            <p className="mt-1 text-sm text-ink/55">Paste a job description and Career Groove will turn it into a clearer next move.</p>
          </div>
        )}
        {applications.map((app) => (
          <RoleListItem
            key={app.id}
            title={app.title}
            company={app.company}
            currentStep={app.currentStep ?? stepFromStatus(app.status)}
            selected={selectedId === app.id}
            readinessReady={trackerReadiness?.ready ?? false}
            onClick={() => onSelect(app.id)}
          />
        ))}
      </div>
    </div>
  );
}

function stepFromStatus(status: string): number {
  const map: Record<string, number> = {
    saved: 1, researching: 1, ready_to_apply: 2,
    applied: 3, follow_up: 3, interviewing: 4,
    offer: 5, rejected: 6, withdrawn: 6, archived: 6,
  };
  return map[status] ?? 1;
}
