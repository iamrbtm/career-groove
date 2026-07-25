"use client";

import { useState, useEffect } from "react";
import { ExternalLink, LoaderCircle, Save } from "lucide-react";

type ResearchData = {
  mission: string; market: string; interest: string;
  redFlags: string; questions: string;
};

function readRecord(value: unknown): Record<string, string> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, string>;
  return {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function ResearchStep({
  applicationId, metadata, sourceUrl, onAdvance,
}: {
  applicationId: string; metadata: Record<string, unknown>; sourceUrl: string | null;
  onAdvance: () => void;
}) {
  const research = readRecord(metadata.research);
  const [form, setForm] = useState<ResearchData>({
    mission: stringValue(research.mission),
    market: stringValue(research.market),
    interest: stringValue(research.interest),
    redFlags: stringValue(research.redFlags),
    questions: stringValue(research.questions),
  });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const r = readRecord(metadata.research);
    setForm({
      mission: stringValue(r.mission),
      market: stringValue(r.market),
      interest: stringValue(r.interest),
      redFlags: stringValue(r.redFlags),
      questions: stringValue(r.questions),
    });
  }, [metadata.research]);

  async function handleSave() {
    setSaving(true);
    setNotice("");
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata: { ...metadata, research: form } }),
      });
      if (!res.ok) throw new Error("Save failed.");
      setNotice("Research saved.");
    } catch {
      setNotice("Could not save research.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-ink/60">
        Capture signal you can use in interviews, outreach, and document tailoring.
      </p>
      {sourceUrl && (
        <a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-cream px-3 py-2 text-xs font-black">
          Open posting <ExternalLink size={14} />
        </a>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <ResearchField label="Mission / company angle" value={form.mission} onChange={(v) => setForm({ ...form, mission: v })} />
        <ResearchField label="Product / market notes" value={form.market} onChange={(v) => setForm({ ...form, market: v })} />
        <ResearchField label="Reasons for interest" value={form.interest} onChange={(v) => setForm({ ...form, interest: v })} />
        <ResearchField label="Red flags" value={form.redFlags} onChange={(v) => setForm({ ...form, redFlags: v })} />
      </div>
      <label className="block text-xs font-black uppercase tracking-[.18em] text-plum">
        Questions to ask
        <textarea value={form.questions} onChange={(e) => setForm({ ...form, questions: e.target.value })} className="mt-2 min-h-24 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold normal-case outline-none" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-mint px-4 py-2.5 text-sm font-black disabled:opacity-60">
          {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
          Save research
        </button>
        <button onClick={onAdvance} className="rounded-2xl border-2 border-ink bg-white px-4 py-2.5 text-sm font-black">
          Skip to Documents
        </button>
      </div>
      {notice && <p className="text-sm font-bold text-ink/65">{notice}</p>}
    </div>
  );
}

function ResearchField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-xs font-black uppercase tracking-[.18em] text-plum">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold normal-case outline-none" />
    </label>
  );
}
