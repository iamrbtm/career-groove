"use client";

import { useState } from "react";
import { Check, LoaderCircle, X } from "lucide-react";

type OfferForm = {
  salary: string; bonus: string; benefitsNotes: string;
  location: string; schedule: string; remotePolicy: string;
  startDate: string; decisionDeadline: string; negotiationStatus: string;
};

export function DecisionStep({
  applicationId, metadata, status, onRefresh,
}: {
  applicationId: string; metadata: Record<string, unknown>; status: string;
  onRefresh: () => Promise<void>;
}) {
  const offer = (metadata.offer && typeof metadata.offer === "object" ? metadata.offer : {}) as Record<string, string>;
  const [form, setForm] = useState<OfferForm>({
    salary: offer.salary || "",
    bonus: offer.bonus || "",
    benefitsNotes: offer.benefitsNotes || "",
    location: offer.location || "",
    schedule: offer.schedule || "",
    remotePolicy: offer.remotePolicy || "",
    startDate: offer.startDate || "",
    decisionDeadline: offer.decisionDeadline || "",
    negotiationStatus: offer.negotiationStatus || "",
  });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  async function saveOffer(decision?: "accepted" | "declined") {
    setSaving(true);
    setNotice("");
    try {
      const offerPayload = {
        salary: form.salary, bonus: form.bonus, benefitsNotes: form.benefitsNotes,
        location: form.location, schedule: form.schedule, remotePolicy: form.remotePolicy,
        startDate: form.startDate, decisionDeadline: form.decisionDeadline,
        negotiationStatus: form.negotiationStatus,
      };
      if (decision) {
        await fetch(`/api/applications/${applicationId}/outcomes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            outcome: decision,
            reason: decision === "accepted" ? "Accepted with confirmation" : "Declined with confirmation",
            userNote: decision === "accepted" ? "Accepted this offer." : "Declined this offer.",
            offer: offerPayload,
          }),
        });
      }
      await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadata: { ...metadata, offer: offerPayload },
        }),
      });
      setNotice(decision ? `Offer ${decision}.` : "Offer details saved.");
      await onRefresh();
    } catch {
      setNotice("Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-ink/60">
        Compare the offer against what matters and make a decision.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <input value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} placeholder="Salary" className="rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
        <input value={form.bonus} onChange={(e) => setForm({ ...form, bonus: e.target.value })} placeholder="Bonus" className="rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
        <input value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} placeholder="Schedule" className="rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
        <input value={form.remotePolicy} onChange={(e) => setForm({ ...form, remotePolicy: e.target.value })} placeholder="Remote policy" className="rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
        <input value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} placeholder="Start date" className="rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
        <input value={form.decisionDeadline} onChange={(e) => setForm({ ...form, decisionDeadline: e.target.value })} placeholder="Decision deadline" className="rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />
      </div>
      <textarea value={form.benefitsNotes} onChange={(e) => setForm({ ...form, benefitsNotes: e.target.value })} placeholder="Benefits notes" className="min-h-20 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none" />

      <div className="flex flex-wrap gap-2">
        <button onClick={() => saveOffer()} disabled={saving} className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-mint px-4 py-2.5 text-sm font-black disabled:opacity-60">
          {saving && !notice ? <LoaderCircle size={16} className="animate-spin" /> : null}
          Save details
        </button>
        <button onClick={() => saveOffer("accepted")} disabled={saving} className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-mint px-4 py-2.5 text-sm font-black disabled:opacity-60">
          <Check size={16} /> Accept
        </button>
        <button onClick={() => saveOffer("declined")} disabled={saving} className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-coral px-4 py-2.5 text-sm font-black text-white disabled:opacity-60">
          <X size={16} /> Decline
        </button>
      </div>

      {notice && <p className="text-sm font-bold text-ink/65">{notice}</p>}
    </div>
  );
}
