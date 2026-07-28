"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, CheckCircle2, LoaderCircle, Mail, MessageCircleMore, RefreshCw, Send, Sparkles, Trash2 } from "lucide-react";
import { AppShell, PageHeading } from "./app-shell";
import { MotionButton } from "./motion-button";
import { followUpTypeLabels, type FollowUpType } from "@/lib/follow-up";

type OverdueFollowUp = {
  id: string;
  applicationId: string;
  followUpType: string;
  subject: string | null;
  message: string | null;
  status: string;
  scheduledFor: string | null;
  applicationTitle: string;
  applicationCompany: string;
  applicationStatus: string;
  priorityLabel: string | null;
};

export function FollowUpDashboard() {
  const router = useRouter();
  const [dueNow, setDueNow] = useState<OverdueFollowUp[]>([]);
  const [undrafted, setUndrafted] = useState<OverdueFollowUp[]>([]);
  const [upcoming, setUpcoming] = useState<OverdueFollowUp[]>([]);
  const [totalOverdue, setTotalOverdue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const loadOverdue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/follow-ups/overdue");
      if (res.ok) {
        const data = await res.json();
        setDueNow(data.dueNow);
        setUndrafted(data.undrafted);
        setUpcoming(data.upcoming);
        setTotalOverdue(data.totalOverdue);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOverdue(); }, [loadOverdue]);

  async function generateDraft(fu: OverdueFollowUp) {
    setGenerating(fu.id);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: "outreach-draft",
          context: { applicationId: fu.applicationId, outreachType: followUpTypeLabels[fu.followUpType as FollowUpType] || "follow-up" },
          messages: [{ role: "user", content: `Write a ${followUpTypeLabels[fu.followUpType as FollowUpType] || "follow-up"} for the ${fu.applicationTitle} role at ${fu.applicationCompany}. Keep it personal and professional.` }],
        }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || "Generation failed.");
      await fetch(`/api/follow-ups/${fu.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, status: "draft" }),
      });
      setNotice("Draft generated!");
      await loadOverdue();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not generate.");
    } finally {
      setGenerating(null);
    }
  }

  async function markSent(id: string) {
    await fetch(`/api/follow-ups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "sent" }),
    });
    await loadOverdue();
  }

  async function skipFollowUp(id: string) {
    await fetch(`/api/follow-ups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "skipped" }),
    });
    await loadOverdue();
  }

  return (
    <AppShell>
      <PageHeading
        eyebrow="Follow-ups"
        title="Stay on top of every outreach."
        copy="Review overdue follow-ups, generate drafts, and track your application conversations."
      />

      <div className="mt-5 flex items-center gap-3">
        {totalOverdue > 0 && (
          <span className="rounded-full bg-coral px-4 py-2 text-sm font-black text-white">
            {totalOverdue} overdue
          </span>
        )}
        <MotionButton onClick={loadOverdue} className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-cream px-4 py-2 text-sm font-black">
          <RefreshCw size={16} /> Refresh
        </MotionButton>
      </div>

      {loading ? (
        <div className="mt-8 grid place-items-center py-20">
          <LoaderCircle size={32} className="animate-spin text-plum" />
        </div>
      ) : (
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 font-[var(--font-display)] text-xl font-black text-coral">
              <Mail size={20} /> Due now
            </h2>
            {dueNow.length === 0 && undrafted.length === 0 ? (
              <div className="rounded-3xl border-2 border-dashed border-ink/20 bg-white/50 p-8 text-center">
                <CheckCircle2 size={32} className="mx-auto text-mint" />
                <p className="mt-3 font-bold text-ink/55">All caught up! No overdue follow-ups.</p>
              </div>
            ) : (
              [...dueNow, ...undrafted].map((fu) => (
                <FollowUpCard
                  key={fu.id}
                  followUp={fu}
                  generating={generating === fu.id}
                  onGenerateDraft={() => generateDraft(fu)}
                  onMarkSent={() => markSent(fu.id)}
                  onSkip={() => skipFollowUp(fu.id)}
                  onOpenApplication={() => router.push(`/applications?applicationId=${fu.applicationId}`)}
                />
              ))
            )}

            <h2 className="mt-8 flex items-center gap-2 font-[var(--font-display)] text-xl font-black text-plum">
              <Calendar size={20} /> Coming this week
            </h2>
            {upcoming.length === 0 ? (
              <p className="rounded-2xl bg-cream p-4 text-sm text-ink/55">No upcoming follow-ups this week.</p>
            ) : (
              upcoming.map((fu) => (
                <FollowUpCard
                  key={fu.id}
                  followUp={fu}
                  generating={false}
                  onGenerateDraft={() => {}}
                  onMarkSent={() => markSent(fu.id)}
                  onSkip={() => skipFollowUp(fu.id)}
                  onOpenApplication={() => router.push(`/applications?applicationId=${fu.applicationId}`)}
                />
              ))
            )}
          </div>

          <div className="rounded-3xl border-2 border-ink bg-white p-6 shadow-[0_5px_0_#26312c]">
            <h2 className="flex items-center gap-2 font-[var(--font-display)] text-xl font-black">
              <Sparkles size={20} className="text-coral" /> Quick tips
            </h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-ink/65">
              <li className="flex gap-3 rounded-2xl bg-cream p-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-mint text-xs font-black">1</span>
                <span><strong className="text-ink">Follow up within 7 days</strong> of applying. Recruiters expect a polite nudge after a week of silence.</span>
              </li>
              <li className="flex gap-3 rounded-2xl bg-cream p-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-sun text-xs font-black">2</span>
                <span><strong className="text-ink">Send a thank-you within 24 hours</strong> of any interview. Reference something specific from the conversation.</span>
              </li>
              <li className="flex gap-3 rounded-2xl bg-cream p-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-coral text-xs font-black text-white">3</span>
                <span><strong className="text-ink">Re-engage after 2 weeks</strong> of no response. A brief, friendly check-in shows persistence without being pushy.</span>
              </li>
              <li className="flex gap-3 rounded-2xl bg-cream p-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-plum text-xs font-black text-white">4</span>
                <span><strong className="text-ink">Use the AI draft feature</strong> to generate personalized messages, then customize before sending.</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {notice && (
        <div className="mt-5 rounded-2xl bg-mint/30 p-4 text-sm font-bold">{notice}</div>
      )}
    </AppShell>
  );
}

function FollowUpCard({
  followUp, generating, onGenerateDraft, onMarkSent, onSkip, onOpenApplication,
}: {
  followUp: OverdueFollowUp; generating: boolean;
  onGenerateDraft: () => void; onMarkSent: () => void; onSkip: () => void; onOpenApplication: () => void;
}) {
  const isOverdue = followUp.scheduledFor && new Date(followUp.scheduledFor) <= new Date();
  return (
    <div className={`rounded-3xl border-2 p-5 ${isOverdue ? "border-coral/40 bg-coral/5" : "border-ink/10 bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-[.18em] text-plum">
              {followUpTypeLabels[followUp.followUpType as FollowUpType] || followUp.followUpType}
            </span>
            {isOverdue && <span className="rounded-full bg-coral/20 px-2 py-0.5 text-[10px] font-black text-coral">OVERDUE</span>}
          </div>
          <button onClick={onOpenApplication} className="mt-1 text-left">
            <p className="truncate font-black hover:text-coral">{followUp.applicationTitle}</p>
            <p className="truncate text-sm text-ink/55">{followUp.applicationCompany}</p>
          </button>
          {followUp.scheduledFor && (
            <p className="mt-1 flex items-center gap-1 text-xs text-ink/50">
              <Calendar size={12} />
              {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric" }).format(new Date(followUp.scheduledFor))}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={onMarkSent} className="rounded-xl bg-mint p-2 text-white" title="Mark sent">
            <CheckCircle2 size={16} />
          </button>
          <button onClick={onSkip} className="rounded-xl bg-coral/20 p-2 text-coral" title="Skip">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {followUp.message ? (
        <div className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-ink/80">
          <p className="whitespace-pre-wrap">{followUp.message}</p>
        </div>
      ) : (
        <button onClick={onGenerateDraft} disabled={generating}
          className="mt-3 flex items-center gap-2 rounded-xl border-2 border-ink/15 bg-white px-4 py-2 text-xs font-black disabled:opacity-60">
          {generating ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {generating ? "Generating..." : "Generate AI draft"}
        </button>
      )}
    </div>
  );
}
