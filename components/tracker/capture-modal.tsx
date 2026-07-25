"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, Send, Tags, X } from "lucide-react";

type CaptureForm = {
  title: string; company: string; location: string;
  workMode: string; salaryMin: string; salaryMax: string;
  sourceUrl: string; description: string; notes: string;
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
        description: description.trim(),
        notes: [
          p.summary ? `Summary: ${p.summary}` : "",
          p.mustHaveSkills?.length ? `Must-have skills: ${p.mustHaveSkills.join(", ")}` : "",
          p.niceToHaveSkills?.length ? `Nice-to-have skills: ${p.niceToHaveSkills.join(", ")}` : "",
          p.redFlags?.length ? `Watch-outs: ${p.redFlags.join(", ")}` : "",
          p.deadline ? `Deadline: ${p.deadline}` : "",
        ].filter(Boolean).join("\n"),
      });
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
      setUrl("");
      setDescription("");
      setForm({ title: "", company: "", location: "", workMode: "unknown", salaryMin: "", salaryMax: "", sourceUrl: "", description: "", notes: "" });
      setParsed(false);
      onSaved(data.application);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
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
  );
}
