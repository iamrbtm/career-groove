"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Calendar, CheckCircle2, FileText, LoaderCircle, Mail, RefreshCw, Search, Send, Sparkles, Trash2, X } from "lucide-react";
import { AppShell, PageHeading } from "./app-shell";
import { MotionButton } from "./motion-button";
import { followUpTypeLabels, type FollowUpType } from "@/lib/follow-up";
import { apiFetch, getApiError } from "@/lib/ui/api-fetch";
import { useToast } from "@/lib/ui/toast";

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
  metadata?: { documentGenerationJobId?: string };
  recipientEmail?: string | null;
};

type SendDialogForm = {
  fu: OverdueFollowUp;
  subject: string;
  message: string;
  recipientEmail: string;
  guesses?: string[];
};

export function FollowUpDashboard() {
  const router = useRouter();
  const { push } = useToast();
  const [dueNow, setDueNow] = useState<OverdueFollowUp[]>([]);
  const [undrafted, setUndrafted] = useState<OverdueFollowUp[]>([]);
  const [upcoming, setUpcoming] = useState<OverdueFollowUp[]>([]);
  const [totalOverdue, setTotalOverdue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);
  const [dialog, setDialog] = useState<SendDialogForm | null>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!dialog) return;
    messageRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDialog(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog]);

  function openSendDialog(fu: OverdueFollowUp) {
    setDialog({
      fu,
      subject: fu.subject ?? `Following up on ${fu.applicationTitle} at ${fu.applicationCompany}`,
      message: fu.message ?? "",
      recipientEmail: fu.recipientEmail ?? "",
    });
  }

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

      const docJobId = await generateDraftDocument(fu);
      await apiFetch(`/api/follow-ups/${fu.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          status: "draft",
          metadata: { documentGenerationJobId: docJobId },
        }),
      });
      push("Draft generated!");
      await loadOverdue();
    } catch (err) {
      push(getApiError(err), "error");
    } finally {
      setGenerating(null);
    }
  }

  async function generateDraftDocument(fu: OverdueFollowUp): Promise<string | undefined> {
    const jobRes = await apiFetch("/api/document-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "cover_letter",
        applicationId: fu.applicationId,
      }),
    });
    const jobData = await jobRes.json();
    const documentJobId = jobData.job?.id as string | undefined;

    if (documentJobId) {
      await apiFetch(`/api/applications/${fu.applicationId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentGenerationJobId: documentJobId,
          kind: "cover_letter",
          title: followUpTypeLabels[fu.followUpType as FollowUpType] || "Follow-up",
          status: "generated",
        }),
      });
    }

    return documentJobId;
  }

  async function findRecipientEmail() {
    if (!dialog) return;
    setFinding(true);
    try {
      const res = await fetch(`/api/follow-ups/${dialog.fu.id}/discover-email`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        push(data.error || "Could not discover recipient email.", "error");
        return;
      }
      if (data.guesses) {
        setDialog((f) => (f ? { ...f, guesses: data.guesses as string[] } : f));
        return;
      }
      setDialog((f) => (f ? { ...f, recipientEmail: data.email as string, guesses: undefined } : f));
    } catch (err) {
      push(getApiError(err), "error");
    } finally {
      setFinding(false);
    }
  }

  async function sendFromDialog() {
    if (!dialog) return;
    const preview = dialog;
    if (!preview.recipientEmail.trim()) {
      push("Recipient email is required.", "error");
      return;
    }
    if (!preview.subject.trim() || !preview.message.trim()) {
      push("Subject and message are required.", "error");
      return;
    }
    setSending(preview.fu.id);
    try {
      const patchBody: Record<string, string> = {};
      if (preview.subject !== (preview.fu.subject ?? `Following up on ${preview.fu.applicationTitle} at ${preview.fu.applicationCompany}`)) {
        patchBody.subject = preview.subject;
      }
      if (preview.message !== (preview.fu.message ?? "")) {
        patchBody.message = preview.message;
      }
      if (Object.keys(patchBody).length > 0) {
        await apiFetch(`/api/follow-ups/${preview.fu.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
        });
      }
      const res = await fetch(`/api/follow-ups/${preview.fu.id}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail: preview.recipientEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        push(data.error || "Failed to send email.", "error");
        return;
      }
      push(`Sent to ${preview.recipientEmail.trim()}.`);
      setDialog(null);
      await loadOverdue();
    } catch (err) {
      push(getApiError(err), "error");
    } finally {
      setSending(null);
    }
  }

  async function markSent(id: string) {
    try {
      await apiFetch(`/api/follow-ups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "sent" }),
      });
    } catch (err) {
      push(getApiError(err), "error");
      return;
    }
    push("Marked as sent.");
    await loadOverdue();
  }

  async function skipFollowUp(id: string) {
    try {
      await apiFetch(`/api/follow-ups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "skipped" }),
      });
    } catch (err) {
      push(getApiError(err), "error");
      return;
    }
    push("Follow-up skipped.");
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
        <MotionButton onClick={loadOverdue} className="flex items-center gap-2 rounded-2xl border-2 border-fg bg-paper px-4 py-2 text-sm font-black">
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
              <div className="rounded-3xl border-2 border-dashed border-edge/20 bg-panel/50 p-8 text-center">
                <CheckCircle2 size={32} className="mx-auto text-mint" />
                <p className="mt-3 font-bold text-fg/55">All caught up! No overdue follow-ups.</p>
              </div>
            ) : (
              [...dueNow, ...undrafted].map((fu) => (
                <FollowUpCard
                  key={fu.id}
                  followUp={fu}
                  generating={generating === fu.id}
                  sending={sending === fu.id}
                  onGenerateDraft={() => generateDraft(fu)}
                  onSendEmail={() => openSendDialog(fu)}
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
              <p className="rounded-2xl bg-paper p-4 text-sm text-fg/55">No upcoming follow-ups this week.</p>
            ) : (
              upcoming.map((fu) => (
                <FollowUpCard
                  key={fu.id}
                  followUp={fu}
                  generating={false}
                  sending={false}
                  onGenerateDraft={() => {}}
                  onSendEmail={() => openSendDialog(fu)}
                  onMarkSent={() => markSent(fu.id)}
                  onSkip={() => skipFollowUp(fu.id)}
                  onOpenApplication={() => router.push(`/applications?applicationId=${fu.applicationId}`)}
                />
              ))
            )}
          </div>

          <div className="rounded-3xl border-2 border-fg bg-panel p-6 shadow-[0_5px_0_#26312c]">
            <h2 className="flex items-center gap-2 font-[var(--font-display)] text-xl font-black">
              <Sparkles size={20} className="text-coral" /> Quick tips
            </h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-fg/65">
              <li className="flex gap-3 rounded-2xl bg-paper p-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-mint text-xs font-black">1</span>
                <span><strong className="text-fg">Follow up within 7 days</strong> of applying. Recruiters expect a polite nudge after a week of silence.</span>
              </li>
              <li className="flex gap-3 rounded-2xl bg-paper p-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-sun text-xs font-black">2</span>
                <span><strong className="text-fg">Send a thank-you within 24 hours</strong> of any interview. Reference something specific from the conversation.</span>
              </li>
              <li className="flex gap-3 rounded-2xl bg-paper p-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-coral text-xs font-black text-white">3</span>
                <span><strong className="text-fg">Re-engage after 2 weeks</strong> of no response. A brief, friendly check-in shows persistence without being pushy.</span>
              </li>
              <li className="flex gap-3 rounded-2xl bg-paper p-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-plum text-xs font-black text-white">4</span>
                <span><strong className="text-fg">Use the AI draft feature</strong> to generate personalized messages, then customize before sending.</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {dialog && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setDialog(null)}
          className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border-2 border-fg bg-panel p-6 shadow-soft"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[.18em] text-plum">Review &amp; send</p>
                <h2 className="mt-1 truncate font-[var(--font-display)] text-2xl font-black">{dialog.fu.applicationTitle}</h2>
                <p className="text-sm font-bold text-fg/55">{dialog.fu.applicationCompany}</p>
              </div>
              <button onClick={() => setDialog(null)} className="grid size-10 shrink-0 place-items-center rounded-2xl bg-paper hover:bg-coral/20">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <input
                value={dialog.subject}
                onChange={(e) => setDialog({ ...dialog, subject: e.target.value })}
                placeholder="Subject"
                className="w-full rounded-2xl bg-paper px-4 py-3 text-sm font-bold outline-none"
              />
              <textarea
                ref={messageRef}
                value={dialog.message}
                onChange={(e) => setDialog({ ...dialog, message: e.target.value })}
                placeholder="Message"
                className="min-h-44 w-full resize-y rounded-2xl bg-paper px-4 py-3 text-sm font-bold outline-none"
              />
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={dialog.recipientEmail}
                  onChange={(e) => setDialog({ ...dialog, recipientEmail: e.target.value })}
                  placeholder="Recipient email"
                  className="w-full rounded-2xl bg-paper px-4 py-3 text-sm font-bold outline-none"
                />
                {!dialog.recipientEmail && (
                  <button
                    onClick={findRecipientEmail}
                    disabled={finding}
                    className="flex shrink-0 items-center gap-1.5 rounded-2xl border-2 border-fg bg-sun px-3 py-2.5 text-xs font-black shadow-[0_3px_0_#26312c] disabled:opacity-60"
                    title="Find email"
                  >
                    {finding ? <LoaderCircle size={14} className="animate-spin" /> : <Search size={14} />}
                    Find email
                  </button>
                )}
              </div>
              {dialog.guesses && dialog.guesses.length > 0 && (
                <div className="rounded-2xl border-2 border-plum/20 bg-plum/5 p-3">
                  <p className="text-xs font-black text-plum">Possible match — pick one:</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {dialog.guesses.map((guess) => (
                      <button
                        key={guess}
                        onClick={() => setDialog({ ...dialog, recipientEmail: guess })}
                        className="rounded-full border-2 border-plum/30 bg-panel px-3 py-1 text-xs font-black text-plum hover:bg-plum hover:text-white"
                      >
                        {guess}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setDialog(null)}
                disabled={sending === dialog.fu.id}
                className="flex flex-1 items-center justify-center rounded-2xl border-2 border-edge/10 bg-panel px-4 py-3 text-sm font-black text-fg/60 hover:bg-paper disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={sendFromDialog}
                disabled={sending === dialog.fu.id}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-fg bg-coral px-4 py-3 text-sm font-black shadow-[0_3px_0_#26312c] disabled:opacity-60"
              >
                {sending === dialog.fu.id ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
                Send
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AppShell>
  );
}

function FollowUpCard({
  followUp, generating, sending, onGenerateDraft, onSendEmail, onMarkSent, onSkip, onOpenApplication,
}: {
  followUp: OverdueFollowUp; generating: boolean; sending: boolean;
  onGenerateDraft: () => void;
  onSendEmail: () => void;
  onMarkSent: () => void; onSkip: () => void; onOpenApplication: () => void;
}) {
  const isOverdue = followUp.scheduledFor && new Date(followUp.scheduledFor) <= new Date();
  const documentJobId = followUp.metadata?.documentGenerationJobId;
  return (
    <div className={`rounded-3xl border-2 p-5 ${isOverdue ? "border-coral/40 bg-coral/5" : "border-edge/10 bg-panel"}`}>
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
            <p className="truncate text-sm text-fg/55">{followUp.applicationCompany}</p>
          </button>
          {followUp.scheduledFor && (
            <p className="mt-1 flex items-center gap-1 text-xs text-fg/50">
              <Calendar size={12} />
              {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric" }).format(new Date(followUp.scheduledFor))}
            </p>
          )}
          {followUp.recipientEmail && (
            <p className="mt-1 flex items-center gap-1 text-xs text-plum/70">
              <Mail size={12} /> {followUp.recipientEmail}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
           {documentJobId && (
             <a
               href={`/documents?jobId=${documentJobId}`}
               className="rounded-xl bg-plum/10 p-2 text-plum hover:bg-plum/20"
               title="View generated document"
             >
               <FileText size={16} />
             </a>
           )}
           {followUp.message && (
             <button
               onClick={onSendEmail}
               disabled={sending}
               className="rounded-xl bg-plum p-2 text-white disabled:opacity-60"
               title="Send email"
             >
               {sending ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
             </button>
           )}
           <button onClick={onMarkSent} className="rounded-xl bg-mint p-2 text-white" title="Mark sent">
             <CheckCircle2 size={16} />
           </button>
           <button onClick={onSkip} className="rounded-xl bg-coral/20 p-2 text-coral" title="Skip">
             <Trash2 size={16} />
           </button>
         </div>
      </div>

      {followUp.message ? (
        <div className="mt-3 rounded-xl bg-panel p-3 text-xs leading-5 text-fg/80">
          <p className="whitespace-pre-wrap">{followUp.message}</p>
        </div>
      ) : (
        <button onClick={onGenerateDraft} disabled={generating}
          className="mt-3 flex items-center gap-2 rounded-xl border-2 border-edge/15 bg-panel px-4 py-2 text-xs font-black disabled:opacity-60">
          {generating ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {generating ? "Generating..." : "Generate AI draft"}
        </button>
      )}
    </div>
  );
}
