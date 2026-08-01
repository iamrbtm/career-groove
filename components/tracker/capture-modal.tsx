"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, CheckCircle2, LoaderCircle, Send, Tags, X } from "lucide-react";

type CaptureForm = {
  title: string; company: string; location: string;
  workMode: string; salaryMin: string; salaryMax: string;
  sourceUrl: string; description: string; notes: string;
};

type FitScore = {
  fit?: number; readiness?: number; desire?: number;
  leverage?: number; risk?: number; timing?: number;
  label?: string; reasons?: string[]; gaps?: string[];
};

type PendingApplication = {
  id: string; title: string; company: string;
  latestScore?: FitScore | null;
};

const FIT_THRESHOLD = 65;

const fitLabels: Record<string, { label: string; bg: string; copy: string }> = {
  apply_first: { label: "Apply first", bg: "bg-mint", copy: "Strong match and you're ready to move on it." },
  research_before_applying: { label: "Research first", bg: "bg-sun/60", copy: "Promising, but needs more signal before you commit." },
  remix_resume_first: { label: "Remix resume first", bg: "bg-sun/60", copy: "Good fit, but your materials need tailoring first." },
  network_first: { label: "Network first", bg: "bg-sky/30", copy: "A referral or contact could open the door here." },
  stretch_role: { label: "Stretch role", bg: "bg-sky/30", copy: "A real stretch — higher risk, possibly still worth it." },
  low_signal_lead: { label: "Low-signal lead", bg: "bg-coral/20", copy: "Thin posting or unclear match. Proceed with care." },
  probably_skip: { label: "Probably skip", bg: "bg-ink/10", copy: "The signals point to passing on this one." },
  follow_up_now: { label: "Follow up now", bg: "bg-mint", copy: "Already applied — time to follow up." },
  prep_mode: { label: "Prep mode", bg: "bg-sky/30", copy: "Already active — focus on prep, not research." },
};

export function CaptureModal({ open, onClose, onSaved }: {
  open: boolean; onClose: () => void;
  onSaved: (application: unknown) => void;
}) {
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [form, setForm] = useState<CaptureForm>({
    title: "", company: "", location: "", workMode: "unknown",
    salaryMin: "", salaryMax: "", sourceUrl: "", description: "", notes: "",
  });
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsed, setParsed] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pendingApplication, setPendingApplication] = useState<PendingApplication | null>(null);

  if (!open) return null;

  async function handleParse() {
    if (!url.trim() && !description.trim()) {
      setNotice("Paste a URL or a job description.");
      return;
    }
    setParsing(true);
    setNotice("");
    setError("");
    setParsed(false);
    try {
      let res: Response;
      if (url.trim()) {
        res = await fetch("/api/applications/parse-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim(), description: description.trim() }),
        });
      } else {
        res = await fetch("/api/applications/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: description.trim() }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not parse.");
      const p = data.parsed;
      setForm({
        title: p.title || "",
        company: p.company || "",
        location: p.location || "",
        workMode: p.workMode || "unknown",
        salaryMin: p.salaryMin ? String(p.salaryMin) : "",
        salaryMax: p.salaryMax ? String(p.salaryMax) : "",
        sourceUrl: p.sourceUrl || url.trim(),
        description: data.rawText || description.trim(),
        notes: [
          p.summary ? `Summary: ${p.summary}` : "",
          p.mustHaveSkills?.length ? `Must-have skills: ${p.mustHaveSkills.join(", ")}` : "",
          p.niceToHaveSkills?.length ? `Nice-to-have skills: ${p.niceToHaveSkills.join(", ")}` : "",
          p.redFlags?.length ? `Watch-outs: ${p.redFlags.join(", ")}` : "",
          p.deadline ? `Deadline: ${p.deadline}` : "",
        ].filter(Boolean).join("\n"),
      });
      if (data.rawText) setDescription(data.rawText);
      setParsed(true);
      setNotice("Parsed. Review before saving.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not parse.");
    } finally {
      setParsing(false);
    }
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || !form.company.trim()) {
      setError("Title and company are required.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          salaryMin: form.salaryMin ? Number(form.salaryMin) : null,
          salaryMax: form.salaryMax ? Number(form.salaryMax) : null,
          sourceUrl: form.sourceUrl || null,
          notes: form.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error("Save failed.");
      const application = data.application;
      const fit = application?.latestScore?.fit;
      if (typeof fit === "number" && fit < FIT_THRESHOLD) {
        setPendingApplication(application);
        setSaving(false);
        return;
      }
      completeSave(application);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function completeSave(application: unknown) {
    setUrl("");
    setDescription("");
    setForm({ title: "", company: "", location: "", workMode: "unknown", salaryMin: "", salaryMax: "", sourceUrl: "", description: "", notes: "" });
    setParsed(false);
    setPendingApplication(null);
    onSaved(application);
    onClose();
  }

  async function discardPending() {
    if (!pendingApplication) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/applications/${pendingApplication.id}`, { method: "DELETE" });
      if (!res.ok) {
        let message = "The draft could not be removed. Please try again.";
        try { const body = await res.json(); if (body?.error) message = body.error; } catch { /* ignore */ }
        throw new Error(message);
      }
      setPendingApplication(null);
      setNotice(`Not added. ${pendingApplication.title} was removed, including any research already started.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The draft could not be removed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4">
      <div className="w-full max-w-2xl rounded-3xl border-2 border-ink bg-white p-6 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-[var(--font-display)] text-2xl font-black">Capture a role</h2>
          <button onClick={onClose} className="grid size-10 place-items-center rounded-2xl bg-cream hover:bg-coral/20">
            <X size={18} />
          </button>
        </div>

        {error && <p className="mt-4 rounded-2xl border-2 border-coral bg-coral/15 p-3 text-sm font-black">{error}</p>}

        <div className="mt-5 space-y-3">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Job posting URL (optional)"
            className="w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Paste the job description (required if no URL)"
            className="min-h-32 w-full resize-y rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none"
          />
          <button
            type="button"
            onClick={handleParse}
            disabled={parsing || (!url.trim() && !description.trim())}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-coral px-4 py-3 text-sm font-black shadow-[0_3px_0_#26312c] disabled:opacity-60"
          >
            {parsing ? <LoaderCircle size={17} className="animate-spin" /> : <Tags size={17} />}
            Parse
          </button>
          {notice && <p className="rounded-2xl bg-mint/20 p-3 text-sm font-bold text-ink/70">{notice}</p>}
        </div>

        {parsed && (
          <form onSubmit={handleSave} className="mt-5 space-y-3">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Role title" className="w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
            <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Company" className="w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location" className="rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
              <select value={form.workMode} onChange={(e) => setForm({ ...form, workMode: e.target.value })} className="rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none">
                <option value="unknown">Work mode</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">Onsite</option>
                <option value="flexible">Flexible</option>
              </select>
            </div>
            <button type="button" onClick={() => setShowEdit(!showEdit)} className="text-xs font-black uppercase tracking-[.18em] text-plum underline decoration-coral decoration-2 underline-offset-4">
              {showEdit ? "Hide" : "Show"} salary & details
            </button>
            {showEdit && (
              <div className="space-y-3 rounded-2xl bg-cream p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input inputMode="numeric" value={form.salaryMin} onChange={(e) => setForm({ ...form, salaryMin: e.target.value })} placeholder="Salary min" className="rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none" />
                  <input inputMode="numeric" value={form.salaryMax} onChange={(e) => setForm({ ...form, salaryMax: e.target.value })} placeholder="Salary max" className="rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none" />
                </div>
                <input value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} placeholder="Source URL" className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none" />
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Private notes" className="min-h-20 w-full resize-y rounded-2xl bg-white px-4 py-3 text-sm font-bold outline-none" />
              </div>
            )}
            <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-sun px-4 py-3 text-sm font-black shadow-[0_3px_0_#26312c] disabled:opacity-60">
              {saving ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={17} />}
              Save opportunity
            </button>
          </form>
        )}
      </div>
    </div>

    {pendingApplication && (
      <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/60 p-4">
        <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border-2 border-ink bg-white p-6 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-plum">Fit check</p>
              <h2 className="mt-1 font-[var(--font-display)] text-2xl font-black">{pendingApplication.title}</h2>
              <p className="text-sm font-bold text-ink/55">{pendingApplication.company}</p>
            </div>
            <button onClick={discardPending} className="grid size-10 shrink-0 place-items-center rounded-2xl bg-cream hover:bg-coral/20">
              <X size={18} />
            </button>
          </div>

          <div className="mt-4 rounded-2xl border-2 border-ink/10 bg-cream p-4">
            <div className="flex items-center gap-4">
              <div className="shrink-0">
                <p className={`grid size-16 place-items-center rounded-2xl border-2 border-ink text-lg font-black ${pendingApplication.latestScore?.fit !== undefined && pendingApplication.latestScore.fit >= 45 ? "bg-sun" : "bg-coral"}`}>
                  {pendingApplication.latestScore?.fit ?? "—"}
                </p>
                <p className="mt-1 text-center text-[10px] font-black uppercase tracking-[.14em] text-ink/55">/100 fit</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-6 text-ink/70">
                  This role scored below the {FIT_THRESHOLD}% fit threshold against your saved skills, preferences, and history.
                </p>
                {pendingApplication.latestScore?.label && (
                  <>
                    <span className={`mt-2 inline-block rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${fitLabels[pendingApplication.latestScore.label]?.bg || "bg-ink/10"}`}>
                      {fitLabels[pendingApplication.latestScore.label]?.label || pendingApplication.latestScore.label}
                    </span>
                    <p className="mt-2 text-xs leading-5 text-ink/55">{fitLabels[pendingApplication.latestScore.label]?.copy}</p>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {(["readiness", "desire", "leverage", "risk", "timing"] as const).map((key) => {
                const value = pendingApplication.latestScore?.[key];
                if (typeof value !== "number") return null;
                const color = value >= 70 ? "bg-mint" : value >= 45 ? "bg-sun" : "bg-coral";
                return (
                  <div key={key} className="rounded-xl bg-white px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-[.14em] text-plum">{key}</p>
                    <p className="mt-0.5 text-sm font-black">{value}</p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/10">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {(pendingApplication.latestScore?.reasons?.length ?? 0) > 0 && (
            <div className="mt-4 rounded-2xl bg-mint/15 p-4">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-plum">
                <CheckCircle2 size={14} /> Why it matches
              </p>
              <ul className="mt-2 space-y-1.5">
                {pendingApplication.latestScore?.reasons?.map((reason) => (
                  <li key={reason} className="flex items-start gap-2 text-sm font-bold text-ink/70">
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-ink/50" /> {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(pendingApplication.latestScore?.gaps?.length ?? 0) > 0 && (
            <div className="mt-4 rounded-2xl bg-coral/15 p-4">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-coral">
                <AlertTriangle size={14} /> What's missing
              </p>
              <ul className="mt-2 space-y-1.5">
                {pendingApplication.latestScore?.gaps?.map((gap) => (
                  <li key={gap} className="flex items-start gap-2 text-sm font-bold text-ink/70">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0 text-coral/70" /> {gap}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-4 text-xs leading-5 text-ink/55">
            You can still add it — the fit score is a nudge, not a rule. If you skip it, the role and anything already created for
            it will be removed.
          </p>

          <div className="mt-4 flex gap-3">
            <button
              onClick={discardPending}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-coral px-4 py-2.5 text-sm font-black disabled:opacity-60"
            >
              {saving ? <LoaderCircle size={16} className="animate-spin" /> : <X size={16} />}
              {saving ? "Removing..." : "Don't add"}
            </button>
            <button
              onClick={() => pendingApplication && completeSave(pendingApplication)}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-mint px-4 py-2.5 text-sm font-black"
            >
              <CheckCircle2 size={16} /> Add anyway
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
