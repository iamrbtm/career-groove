"use client";

import { FormEvent, useState } from "react";
import { Archive, LoaderCircle, Trash2 } from "lucide-react";

type Outcome = {
  id: string; outcome: string; stage: string | null;
  reason: string | null; userNote: string | null;
  source: string | null; roleFit?: string; similarStrategy?: string;
  occurredAt: string;
};

type Insight = { id: string; kind: string; title: string; copy: string; suggestion: string; confidence: string };

export function ClosedStep({
  applicationId, status, outcomes, insights, onRefresh, onArchive, onDelete,
}: {
  applicationId: string; status: string; outcomes: Outcome[];
  insights: { lowData: boolean; insights: Insight[] } | null;
  onRefresh: () => Promise<void>; onArchive: () => void; onDelete?: () => void;
}) {
  const [outcomeForm, setOutcomeForm] = useState({
    outcome: "rejected", stage: "", reason: "", userNote: "",
    source: "", roleFit: "unclear", similarStrategy: "neutral",
  });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  async function logOutcome(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      const res = await fetch(`/api/applications/${applicationId}/outcomes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(outcomeForm),
      });
      if (!res.ok) throw new Error("Could not log outcome.");
      setNotice("Outcome logged.");
      await onRefresh();
    } catch {
      setNotice("Could not log outcome.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-ink/60">
        Log what happened and close out this role.
      </p>

      <form onSubmit={logOutcome} className="rounded-2xl bg-cream p-4">
        <p className="text-xs font-black uppercase tracking-[.18em] text-plum">Log outcome</p>
        <select
          value={outcomeForm.outcome}
          onChange={(e) => setOutcomeForm({ ...outcomeForm, outcome: e.target.value })}
          className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none"
        >
          <option value="rejected">Rejected</option>
          <option value="no_response">No response</option>
          <option value="withdrew">Withdrew</option>
          <option value="offer">Offer</option>
          <option value="accepted">Accepted</option>
          <option value="declined">Declined</option>
        </select>
        <input
          value={outcomeForm.stage}
          onChange={(e) => setOutcomeForm({ ...outcomeForm, stage: e.target.value })}
          placeholder="Stage (applied, screen, onsite...)"
          className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none"
        />
        <input
          value={outcomeForm.reason}
          onChange={(e) => setOutcomeForm({ ...outcomeForm, reason: e.target.value })}
          placeholder="Reason or signal"
          className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none"
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <select
            value={outcomeForm.roleFit}
            onChange={(e) => setOutcomeForm({ ...outcomeForm, roleFit: e.target.value })}
            className="rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none"
          >
            <option value="unclear">Fit felt unclear</option>
            <option value="fit">Felt like a fit</option>
            <option value="stretch">Felt like a stretch</option>
            <option value="mismatch">Felt like a mismatch</option>
          </select>
          <select
            value={outcomeForm.similarStrategy}
            onChange={(e) => setOutcomeForm({ ...outcomeForm, similarStrategy: e.target.value })}
            className="rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none"
          >
            <option value="neutral">No targeting change</option>
            <option value="prioritize">Prioritize similar roles</option>
            <option value="deprioritize">Deprioritize similar roles</option>
          </select>
        </div>
        <textarea
          value={outcomeForm.userNote}
          onChange={(e) => setOutcomeForm({ ...outcomeForm, userNote: e.target.value })}
          placeholder="What happened?"
          className="mt-3 min-h-24 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none"
        />
        <button
          disabled={saving}
          className="mt-3 rounded-2xl border-2 border-ink bg-mint px-4 py-2.5 text-sm font-black disabled:opacity-60"
        >
          {saving ? <LoaderCircle size={16} className="animate-spin" /> : null}
          Log outcome
        </button>
      </form>

      {outcomes.length > 0 && (
        <div className="rounded-2xl bg-cream p-4">
          <p className="text-xs font-black uppercase tracking-[.18em] text-plum">Logged outcomes</p>
          <div className="mt-3 space-y-2">
            {outcomes.map((o) => (
              <p key={o.id} className="text-sm font-bold text-ink/70">
                {o.outcome.replace("_", " ")} · {o.stage || "N/A"}{o.reason ? ` · ${o.reason}` : ""}
              </p>
            ))}
          </div>
        </div>
      )}

      {insights?.insights && insights.insights.length > 0 && (
        <div className="rounded-2xl bg-cream p-4">
          <p className="text-xs font-black uppercase tracking-[.18em] text-plum">Rejection Intelligence</p>
          {insights.insights.slice(0, 3).map((insight) => (
            <div key={insight.id} className="mt-3">
              <p className="font-black text-sm">{insight.title}</p>
              <p className="text-xs text-ink/65">{insight.suggestion}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onArchive}
          className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-white px-4 py-2.5 text-sm font-black"
        >
          <Archive size={16} /> Archive role
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            className="flex items-center gap-2 rounded-2xl border-2 border-coral/40 bg-coral/10 px-4 py-2.5 text-sm font-black text-coral"
          >
            <Trash2 size={16} /> Delete role
          </button>
        )}
      </div>

      {notice && <p className="text-sm font-bold text-ink/65">{notice}</p>}
    </div>
  );
}
