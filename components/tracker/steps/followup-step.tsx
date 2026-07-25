"use client";

import { useState } from "react";
import { LoaderCircle, Send } from "lucide-react";

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  try {
    const date = new Date(value);
    return date.toISOString().slice(0, 16);
  } catch {
    return "";
  }
}

export function FollowUpStep({
  applicationId, followUpDueAt, onRefresh,
}: {
  applicationId: string; followUpDueAt: string | null; onRefresh: () => Promise<void>;
}) {
  const [followUpValue, setFollowUpValue] = useState(toLocalDateTime(followUpDueAt));
  const [outreachType, setOutreachType] = useState("recruiter follow-up");
  const [outreachDraft, setOutreachDraft] = useState("");
  const [aiLoading, setAiLoading] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  async function saveFollowUp() {
    setSaving(true);
    setNotice("");
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followUpDueAt: followUpValue ? new Date(followUpValue).toISOString() : null }),
      });
      if (!res.ok) throw new Error("Save failed.");
      setNotice("Follow-up date saved.");
      await onRefresh();
    } catch {
      setNotice("Could not save follow-up.");
    } finally {
      setSaving(false);
    }
  }

  async function generateDraft() {
    setAiLoading("outreach");
    setOutreachDraft("");
    setNotice("");
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: "outreach-draft",
          context: { applicationId, outreachType },
          messages: [{ role: "user", content: `Draft a ${outreachType} for this role.` }],
        }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || "Could not generate draft.");
      setOutreachDraft(text);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not generate draft.");
    } finally {
      setAiLoading("");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-ink/60">
        Set a follow-up reminder and draft outreach notes.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-cream p-4">
          <p className="text-xs font-black uppercase tracking-[.18em] text-plum">Follow-up date</p>
          <input
            type="datetime-local"
            value={followUpValue}
            onChange={(e) => setFollowUpValue(e.target.value)}
            className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none"
          />
          <button
            onClick={saveFollowUp}
            disabled={saving}
            className="mt-3 rounded-2xl border-2 border-ink bg-mint px-4 py-2.5 text-sm font-black disabled:opacity-60"
          >
            {saving ? <LoaderCircle size={16} className="animate-spin" /> : null}
            Save date
          </button>
        </div>

        <div className="rounded-2xl bg-cream p-4">
          <p className="text-xs font-black uppercase tracking-[.18em] text-plum">Outreach draft</p>
          <select
            value={outreachType}
            onChange={(e) => setOutreachType(e.target.value)}
            className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none"
          >
            {["referral request", "recruiter follow-up", "thank-you note", "post-final-round check-in", "offer negotiation note", "relationship maintenance"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <button
            onClick={generateDraft}
            disabled={aiLoading === "outreach"}
            className="mt-3 rounded-2xl border-2 border-ink bg-sun px-4 py-2.5 text-sm font-black disabled:opacity-60"
          >
            {aiLoading === "outreach" ? "Drafting..." : "Draft note"}
          </button>
          {outreachDraft && (
            <textarea
              value={outreachDraft}
              onChange={(e) => setOutreachDraft(e.target.value)}
              className="mt-3 min-h-32 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none"
            />
          )}
        </div>
      </div>

      {notice && <p className="text-sm font-bold text-ink/65">{notice}</p>}
    </div>
  );
}
