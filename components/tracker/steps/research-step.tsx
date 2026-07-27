"use client";

import { useState, useEffect } from "react";
import { ExternalLink, LoaderCircle, Save, Sparkles, SearchX } from "lucide-react";

type ResearchData = {
  mission: string; market: string; interest: string;
  redFlags: string; questions: string;
};

function readRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
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
  const stored = readRecord(metadata.research);
  const autoRaw = readRecord(metadata.autoResearch);
  const autoStatus = stringValue(autoRaw.status);
  const hasAutoData = autoStatus === "done";
  const autoSources = Array.isArray(autoRaw.sources) ? (autoRaw.sources as string[]) : [];

  const [form, setForm] = useState<ResearchData>({
    mission: hasAutoData ? stringValue(autoRaw.mission) : stringValue(stored.mission),
    market: hasAutoData ? stringValue(autoRaw.market) : stringValue(stored.market),
    interest: hasAutoData ? stringValue(autoRaw.interest) : stringValue(stored.interest),
    redFlags: hasAutoData ? stringValue(autoRaw.redFlags) : stringValue(stored.redFlags),
    questions: hasAutoData ? stringValue(autoRaw.questions) : stringValue(stored.questions),
  });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const r = readRecord(metadata.research);
    const a = readRecord(metadata.autoResearch);
    const done = stringValue(a.status) === "done";
    setForm({
      mission: done ? stringValue(a.mission) : stringValue(r.mission),
      market: done ? stringValue(a.market) : stringValue(r.market),
      interest: done ? stringValue(a.interest) : stringValue(r.interest),
      redFlags: done ? stringValue(a.redFlags) : stringValue(r.redFlags),
      questions: done ? stringValue(a.questions) : stringValue(r.questions),
    });
  }, [metadata.research, metadata.autoResearch]);

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
      {autoStatus === "failed" && (
        <div className="rounded-2xl border-2 border-sun/60 bg-sun/15 p-4">
          <div className="flex items-start gap-3">
            <SearchX size={20} className="mt-0.5 shrink-0 text-ink/60" />
            <div>
              <p className="font-black text-sm">This one needs a human touch</p>
              <p className="mt-1 text-sm font-bold text-ink/60">
                We couldn&apos;t find enough about this company online to pre-fill the research.
                The fields below are ready for what you know or discover — every signal helps.
              </p>
            </div>
          </div>
        </div>
      )}

      {autoStatus === "unsupported" && (
        <div className="rounded-2xl border-2 border-sun/60 bg-sun/15 p-4">
          <div className="flex items-start gap-3">
            <SearchX size={20} className="mt-0.5 shrink-0 text-ink/60" />
            <div>
              <p className="font-black text-sm">No link or company to research</p>
              <p className="mt-1 text-sm font-bold text-ink/60">
                Without a posting URL or company name, we can&apos;t auto-research this one.
                Fill in what you know below — it will help with tailoring later.
              </p>
            </div>
          </div>
        </div>
      )}

      {hasAutoData && (
        <div className="rounded-2xl border-2 border-mint/60 bg-mint/15 p-4">
          <div className="flex items-start gap-3">
            <Sparkles size={20} className="mt-0.5 shrink-0 text-ink/60" />
            <div>
              <p className="font-black text-sm">Auto-researched from the posting</p>
              <p className="mt-1 text-sm font-bold text-ink/60">
                We looked up the company and pre-filled what we found. Tweak anything that feels off.
              </p>
              {autoRaw.sources && Array.isArray(autoRaw.sources) && autoRaw.sources.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {autoRaw.sources.slice(0, 3).map((s: string) => (
                    <span key={s} className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-bold text-ink/50">{s}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
