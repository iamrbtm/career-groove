"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendar, CheckCircle2, LoaderCircle, Mail, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import { followUpTypeLabels, followUpTypeDescriptions, buildFollowUpSubject, getDefaultDelay, type FollowUpType, followUpTypes } from "@/lib/follow-up";

type FollowUpItem = {
  id: string;
  applicationId: string;
  sequenceNumber: number;
  followUpType: FollowUpType;
  subject: string | null;
  message: string | null;
  status: string;
  scheduledFor: string | null;
  sentAt: string | null;
  deliveryMethod: string;
  aiGenerated: boolean;
  createdAt: string;
};

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  try { return new Date(value).toISOString().slice(0, 16); } catch { return ""; }
}

export function FollowUpStep({
  applicationId, followUpDueAt, applicationTitle, applicationCompany, onRefresh,
}: {
  applicationId: string; followUpDueAt: string | null; applicationTitle?: string; applicationCompany?: string; onRefresh: () => Promise<void>;
}) {
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newType, setNewType] = useState<FollowUpType>("general_check");
  const [newDate, setNewDate] = useState(toLocalDateTime(followUpDueAt));
  const [generating, setGenerating] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const title = applicationTitle || "this role";
  const company = applicationCompany || "the company";

  const loadFollowUps = useCallback(async () => {
    try {
      const res = await fetch(`/api/follow-ups?applicationId=${applicationId}`);
      if (res.ok) {
        const data = await res.json();
        setFollowUps(data.followUps);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => { loadFollowUps(); }, [loadFollowUps]);

  async function addFollowUp() {
    setSaving(true);
    setNotice("");
    try {
      const scheduledFor = newDate ? new Date(newDate).toISOString() : null;
      const subject = buildFollowUpSubject(newType, title, company);
      const res = await fetch("/api/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          sequenceNumber: followUps.length + 1,
          followUpType: newType,
          subject,
          scheduledFor,
          deliveryMethod: "in_app",
        }),
      });
      if (!res.ok) throw new Error("Could not create follow-up.");
      setNotice("Follow-up scheduled.");
      setNewType("general_check");
      if (!newDate) {
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + getDefaultDelay(newType));
        setNewDate(defaultDate.toISOString().slice(0, 16));
      }
      await loadFollowUps();
      await onRefresh();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not schedule.");
    } finally {
      setSaving(false);
    }
  }

  async function generateDraft(followUp: FollowUpItem) {
    setGenerating(followUp.id);
    setNotice("");
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: "outreach-draft",
          context: { applicationId, outreachType: followUpTypeLabels[followUp.followUpType] },
          messages: [{ role: "user", content: `Write a ${followUpTypeLabels[followUp.followUpType]} for the ${title} role at ${company}. The draft should feel personal and specific.` }],
        }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || "Generation failed.");
      const updateRes = await fetch(`/api/follow-ups/${followUp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, subject: followUp.subject || buildFollowUpSubject(followUp.followUpType, title, company), status: "draft" }),
      });
      if (updateRes.ok) await loadFollowUps();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not generate.");
    } finally {
      setGenerating(null);
    }
  }

  async function scheduleFollowUp(followUp: FollowUpItem) {
    setSaving(true);
    try {
      const res = await fetch(`/api/follow-ups/${followUp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "scheduled" }),
      });
      if (res.ok) await loadFollowUps();
    } finally {
      setSaving(false);
    }
  }

  async function deleteFollowUp(id: string) {
    await fetch(`/api/follow-ups/${id}`, { method: "DELETE" });
    await loadFollowUps();
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-ink/10 text-ink/60",
      scheduled: "bg-sun/70 text-ink",
      sent: "bg-mint text-ink",
      skipped: "bg-coral/20 text-coral",
      failed: "bg-coral/20 text-coral",
    };
    return <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[.16em] ${colors[status] || "bg-ink/10"}`}>{status}</span>;
  };

  if (loading) return <div className="rounded-2xl bg-cream p-6 text-center text-sm text-ink/55">Loading follow-ups...</div>;

  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-ink/60">
        Schedule a sequence of follow-up messages. Create drafts with AI, set timing, and track what has been sent.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-cream p-4">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-plum"><Plus size={14} /> New follow-up</p>
          <label className="mt-3 block text-[10px] font-black uppercase tracking-[.16em] text-ink/55">Type</label>
          <select value={newType} onChange={(e) => setNewType(e.target.value as FollowUpType)}
            className="mt-1 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none">
            {followUpTypes.map((t) => <option key={t} value={t}>{followUpTypeLabels[t]}</option>)}
          </select>
          <p className="mt-2 text-xs text-ink/50">{followUpTypeDescriptions[newType]}</p>
          <label className="mt-3 block text-[10px] font-black uppercase tracking-[.16em] text-ink/55">Schedule for</label>
          <input type="datetime-local" value={newDate} onChange={(e) => setNewDate(e.target.value)}
            className="mt-1 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none" />
          <button onClick={addFollowUp} disabled={saving}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-mint px-4 py-2.5 text-sm font-black disabled:opacity-60">
            {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Calendar size={16} />}
            {saving ? "Saving..." : "Add to sequence"}
          </button>
        </div>

        <div className="rounded-2xl bg-cream p-4">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-plum"><Sparkles size={14} /> AI draft assistant</p>
          <p className="mt-2 text-xs text-ink/55">Generate a draft from a saved follow-up below, or write your own. AI drafts are personalized to this role.</p>
        </div>
      </div>

      {followUps.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-black uppercase tracking-[.18em] text-plum">
            Follow-up sequence ({followUps.length})
          </p>
          {followUps.map((fu) => (
            <div key={fu.id} className="rounded-2xl border-2 border-ink/10 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-plum text-[10px] font-black text-white">
                      {fu.sequenceNumber}
                    </span>
                    <p className="truncate font-black text-sm">{followUpTypeLabels[fu.followUpType]}</p>
                    {statusBadge(fu.status)}
                  </div>
                  {fu.subject && <p className="mt-1 truncate text-xs text-ink/55">{fu.subject}</p>}
                  {fu.scheduledFor && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-ink/50">
                      <Calendar size={12} />
                      {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(fu.scheduledFor))}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {fu.status === "draft" && (
                    <button onClick={() => scheduleFollowUp(fu)} disabled={saving}
                      className="rounded-xl border-2 border-ink bg-sun px-3 py-1.5 text-[10px] font-black disabled:opacity-60">
                      Schedule
                    </button>
                  )}
                  <button onClick={() => deleteFollowUp(fu.id)}
                    className="rounded-xl p-1.5 text-coral hover:bg-coral/10">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {fu.message ? (
                <div className="mt-3 rounded-xl bg-cream p-3">
                  <p className="whitespace-pre-wrap text-xs leading-5 text-ink/80">{fu.message}</p>
                </div>
              ) : (
                <button onClick={() => generateDraft(fu)} disabled={generating === fu.id}
                  className="mt-3 flex items-center gap-2 rounded-xl border-2 border-ink/15 bg-cream px-4 py-2 text-xs font-black disabled:opacity-60">
                  {generating === fu.id ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {generating === fu.id ? "Generating..." : "Generate AI draft"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {followUps.length === 0 && !loading && (
        <div className="rounded-2xl border-2 border-dashed border-ink/20 bg-white/50 p-6 text-center">
          <Send size={24} className="mx-auto text-coral" />
          <p className="mt-2 text-sm font-bold text-ink/55">No follow-ups scheduled yet. Add your first one above.</p>
        </div>
      )}

      {notice && <p className="text-sm font-bold text-ink/65">{notice}</p>}
    </div>
  );
}
