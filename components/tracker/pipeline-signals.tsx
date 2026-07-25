"use client";

import { useState } from "react";
import { BarChart3, ChevronDown, ChevronUp } from "lucide-react";

type Analytics = {
  summary: {
    total: number; savedThisWeek: number; submittedCount: number;
    followUpsDue: number; interviewsActive: number; offersActive: number;
    responseRate: number; interviewRate: number; followUpHealth?: number;
  };
  sourceHealth?: Array<{ source: string; total: number; responses: number; responseRate: number }>;
  resumePerformance?: Array<{ version: string; outcomes: number; positive: number; positiveRate: number }>;
  labels?: Array<{ label: string; count: number }>;
  roleFitTrends?: Array<{ roleFit: string; similarStrategy: string; count: number }>;
};

export function PipelineSignals({ analytics }: { analytics: Analytics | null }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-3xl border-2 border-ink/15 bg-white/70">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 p-5 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-2xl border-2 border-ink bg-mint/50">
            <BarChart3 size={19} />
          </div>
          <h2 className="font-[var(--font-display)] text-xl font-black">Pipeline Signals</h2>
        </div>
        {open ? <ChevronUp size={20} className="shrink-0 text-ink/40" /> : <ChevronDown size={20} className="shrink-0 text-ink/40" />}
      </button>
      {open && (
        <div className="border-t border-ink/10 px-5 pb-6 space-y-4">
          {!analytics && <p className="text-sm font-bold text-ink/55">Save a few roles to see pipeline signals here.</p>}
          {analytics && (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <Metric value={`${analytics.summary.total}`} label="Active roles" />
                <Metric value={`${analytics.summary.responseRate}%`} label="Response rate" />
                <Metric value={`${analytics.summary.interviewRate}%`} label="Interview rate" />
                <Metric value={`${analytics.summary.followUpHealth ?? 0}%`} label="Follow-up health" />
              </div>
              {analytics.sourceHealth && analytics.sourceHealth.length > 0 && (
                <div>
                  <p className="text-xs font-black uppercase tracking-[.18em] text-plum mb-2">Source health</p>
                  <div className="space-y-2">
                    {analytics.sourceHealth.slice(0, 3).map((s) => (
                      <p key={s.source} className="text-sm font-bold text-ink/70">{s.source} · {s.responseRate}% response · {s.total} roles</p>
                    ))}
                  </div>
                </div>
              )}
              {analytics.resumePerformance && analytics.resumePerformance.length > 0 && (
                <div>
                  <p className="text-xs font-black uppercase tracking-[.18em] text-plum mb-2">Resume signal</p>
                  <div className="space-y-2">
                    {analytics.resumePerformance.slice(0, 3).map((r) => (
                      <p key={r.version} className="text-sm font-bold text-ink/70">{r.version} · {r.positiveRate}% positive · {r.outcomes} outcomes</p>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-cream p-3">
      <p className="font-[var(--font-display)] text-xl font-black">{value}</p>
      <p className="text-xs font-bold text-ink/55">{label}</p>
    </div>
  );
}
