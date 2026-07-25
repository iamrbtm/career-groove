"use client";

import { FormEvent, useState } from "react";
import { Sparkles } from "lucide-react";
import Link from "next/link";

type Interview = {
  id: string; roundType: string; scheduledAt: string | null;
  interviewer: string | null; meetingLink: string | null; prepStatus: string;
};

function formatDate(value: string | null, options?: Intl.DateTimeFormatOptions) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", options || { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function InterviewStep({
  applicationId, interviews, onRefresh,
}: {
  applicationId: string; interviews: Interview[]; onRefresh: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    roundType: "screen", scheduledAt: "", interviewer: "", meetingLink: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  async function addInterview(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      const res = await fetch(`/api/applications/${applicationId}/interviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : "",
        }),
      });
      if (!res.ok) throw new Error("Could not add interview.");
      setForm({ roundType: "screen", scheduledAt: "", interviewer: "", meetingLink: "", notes: "" });
      setNotice("Interview saved.");
      await onRefresh();
    } catch {
      setNotice("Could not add interview.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-ink/60">
        Track interview rounds and prep for each one.
      </p>

      <form onSubmit={addInterview} className="rounded-2xl bg-cream p-4">
        <p className="text-xs font-black uppercase tracking-[.18em] text-plum">Add interview round</p>
        <input
          value={form.roundType}
          onChange={(e) => setForm({ ...form, roundType: e.target.value })}
          placeholder="Round type (screen, onsite, etc.)"
          className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none"
        />
        <input
          type="datetime-local"
          value={form.scheduledAt}
          onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
          className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none"
        />
        <input
          value={form.interviewer}
          onChange={(e) => setForm({ ...form, interviewer: e.target.value })}
          placeholder="Interviewer"
          className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none"
        />
        <input
          value={form.meetingLink}
          onChange={(e) => setForm({ ...form, meetingLink: e.target.value })}
          placeholder="Meeting link"
          className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none"
        />
        <button disabled={saving} className="mt-3 rounded-2xl border-2 border-ink bg-mint px-4 py-2.5 text-sm font-black disabled:opacity-60">
          Save interview
        </button>
      </form>

      {interviews.length > 0 && (
        <div className="rounded-2xl bg-cream p-4">
          <p className="text-xs font-black uppercase tracking-[.18em] text-plum">Upcoming & past</p>
          <div className="mt-3 space-y-2">
            {interviews.map((iv) => (
              <p key={iv.id} className="text-sm font-bold text-ink/70">
                {iv.roundType} · {formatDate(iv.scheduledAt)}{iv.interviewer ? ` · ${iv.interviewer}` : ""}
              </p>
            ))}
          </div>
        </div>
      )}

      <Link
        href={`/mock-interview?applicationId=${applicationId}`}
        className="inline-flex items-center gap-2 rounded-2xl border-2 border-ink bg-white px-4 py-2.5 text-sm font-black"
      >
        <Sparkles size={16} /> Open Soundcheck
      </Link>

      {notice && <p className="text-sm font-bold text-ink/65">{notice}</p>}
    </div>
  );
}
