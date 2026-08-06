"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, LoaderCircle, MapPin, Plus, Sparkles, X } from "lucide-react";

type Opportunity = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  workMode: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  sourceUrl: string | null;
  source: string | null;
  summary: string;
  reason: string | null;
  fit: number;
  label: string;
};

type SearchResponse = { opportunities: Opportunity[]; skippedCount: number };

function fitColor(fit: number) {
  if (fit >= 70) return "bg-mint";
  if (fit >= 45) return "bg-sun";
  return "bg-coral";
}

function formatSalary(opportunity: Opportunity) {
  const currency = opportunity.salaryCurrency || "USD";
  let format: Intl.NumberFormat;
  try {
    format = new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 });
  } catch {
    format = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }
  if (opportunity.salaryMin != null && opportunity.salaryMax != null) {
    return `${format.format(opportunity.salaryMin)} - ${format.format(opportunity.salaryMax)}`;
  }
  if (opportunity.salaryMin != null) return `${format.format(opportunity.salaryMin)}+`;
  if (opportunity.salaryMax != null) return `up to ${format.format(opportunity.salaryMax)}`;
  return "Salary not listed";
}

function trimSummary(summary: string) {
  return summary.length > 260 ? `${summary.slice(0, 260).trim()}…` : summary;
}

export function OpportunitySearchModal({ open, onClose, onSaved }: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [skippedCount, setSkippedCount] = useState(0);
  const [error, setError] = useState("");
  const [runId, setRunId] = useState(0);

  const runSearch = useCallback(async () => {
    setSearching(true);
    setError("");
    setOpportunities([]);
    setSelected(new Set());
    setSkippedCount(0);
    try {
      const res = await fetch("/api/opportunity-search", { method: "POST" });
      const data: SearchResponse & { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not search for opportunities.");
      setOpportunities(data.opportunities || []);
      setSkippedCount(data.skippedCount || 0);
      setSelected(new Set((data.opportunities || []).map((item) => item.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not search for opportunities.");
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setRunId((current) => current + 1);
    }
  }, [open]);

  useEffect(() => {
    if (open && runId > 0) void runSearch();
  }, [open, runId, runSearch]);

  if (!open) return null;

  async function dismissPending() {
    try {
      await fetch("/api/opportunity-search/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [] }),
      });
    } catch {
      // Best effort — stale reviewed rows are cleaned on the next search.
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(opportunities.map((item) => item.id)));
  }

  function selectNone() {
    setSelected(new Set());
  }

  async function handleAdd() {
    if (!selected.size) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/opportunity-search/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The selected opportunities could not be added.");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The selected opportunities could not be added.");
      setSaving(false);
    }
  }

  async function handleSkipAll() {
    setSaving(true);
    await dismissPending();
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-3xl border-2 border-ink bg-white shadow-soft">
        <div className="flex items-start justify-between gap-3 border-b-2 border-ink/10 p-5">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-coral">
              <Sparkles size={20} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-plum">Opportunity search</p>
              <h2 className="font-[var(--font-display)] text-2xl font-black">Find jobs from your skills</h2>
              <p className="mt-1 text-sm leading-5 text-ink/55">
                ChatGPT reviews your qualifications and skills, then hunts for roles you're genuinely qualified for. Sorted by fit. Already-seen roles are skipped.
              </p>
            </div>
          </div>
          <button
            onClick={() => { void handleSkipAll(); }}
            disabled={saving || searching}
            className="grid size-10 shrink-0 place-items-center rounded-2xl bg-cream hover:bg-coral/20 disabled:opacity-60"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {error && <p className="mx-5 mt-4 rounded-2xl border-2 border-coral bg-coral/15 p-3 text-sm font-black">{error}</p>}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {searching && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <LoaderCircle size={34} className="animate-spin text-coral" />
              <p className="font-black">Matching your skills to open roles...</p>
              <p className="text-sm text-ink/55">ChatGPT is reading your qualifications and hunting for jobs you're qualified for. This can take a few seconds.</p>
            </div>
          )}

          {!searching && !error && opportunities.length === 0 && (
            <div className="py-16 text-center">
              <CheckCircle2 size={30} className="mx-auto text-mint" />
              <p className="mt-4 font-black">No fresh openings right now</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-ink/55">
                {skippedCount > 0
                  ? `${skippedCount} role${skippedCount === 1 ? " was" : "s were"} already in your tracker or previously dismissed. Try again in a few days for new listings.`
                  : "The job boards did not return anything new that matches right now. Try again in a little while, or widen your desired titles and skills in Settings."}
              </p>
            </div>
          )}

          {!searching && opportunities.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-3 pb-3">
                <p className="text-xs font-black uppercase tracking-[.16em] text-plum">
                  {selected.size} of {opportunities.length} selected
                </p>
                <div className="flex gap-3 text-xs font-bold">
                  <button onClick={selectAll} className="underline decoration-coral decoration-2 underline-offset-4">Select all</button>
                  <button onClick={selectNone} className="underline decoration-coral decoration-2 underline-offset-4">Select none</button>
                </div>
              </div>

              <div className="space-y-3">
                {opportunities.map((opportunity, index) => {
                  const checked = selected.has(opportunity.id);
                  return (
                    <article
                      key={opportunity.id}
                      className={`rounded-2xl border-2 p-4 transition-colors ${checked ? "border-ink bg-cream" : "border-ink/15 bg-white/60 opacity-70"}`}
                    >
                      <div className="flex items-start gap-3">
                        <label className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-xl border-2 border-ink bg-white">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(opportunity.id)}
                            className="size-4 accent-coral"
                            aria-label={`Include ${opportunity.title} at ${opportunity.company}`}
                          />
                        </label>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="rounded-full bg-plum px-2.5 py-0.5 text-[10px] font-black text-white">{index + 1}</span>
                                <h3 className="truncate font-[var(--font-display)] text-lg font-black">{opportunity.title}</h3>
                              </div>
                              <p className="text-sm font-bold text-ink/55">{opportunity.company}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className={`grid size-12 place-items-center rounded-2xl border-2 border-ink text-base font-black ${fitColor(opportunity.fit)}`}>
                                {opportunity.fit}
                              </p>
                              <p className="mt-0.5 text-[10px] font-black uppercase tracking-[.14em] text-ink/55">fit</p>
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-ink/60">
                            <span className="font-black text-plum">{formatSalary(opportunity)}</span>
                            {opportunity.location && (
                              <span className="flex items-center gap-1"><MapPin size={13} /> {opportunity.location}</span>
                            )}
                            {opportunity.workMode && opportunity.workMode !== "unknown" && (
                              <span className="capitalize">{opportunity.workMode}</span>
                            )}
                            {opportunity.source && <span className="text-ink/40">{opportunity.source}</span>}
                          </div>

                          <p className="mt-2 text-sm leading-5 text-ink/70">{trimSummary(opportunity.summary)}</p>
                          {opportunity.reason && (
                            <p className="mt-1.5 text-xs font-bold text-plum">Why it fits: {opportunity.reason}</p>
                          )}
                          {opportunity.sourceUrl && (
                            <a
                              href={opportunity.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex items-center gap-1 text-xs font-black text-coral underline decoration-coral decoration-2 underline-offset-4"
                            >
                              View posting <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {!searching && opportunities.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-t-2 border-ink/10 p-5">
            <button
              onClick={() => { void handleSkipAll(); }}
              disabled={saving}
              className="rounded-2xl border-2 border-ink bg-white px-4 py-3 text-sm font-black disabled:opacity-60"
            >
              Skip all
            </button>
            <button
              onClick={() => { void handleAdd(); }}
              disabled={saving || selected.size === 0}
              className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-mint px-5 py-3 text-sm font-black shadow-[0_3px_0_#26312c] disabled:opacity-60"
            >
              {saving ? <LoaderCircle size={17} className="animate-spin" /> : <Plus size={17} />}
              {saving ? "Adding..." : `Add ${selected.size} to pipeline`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
