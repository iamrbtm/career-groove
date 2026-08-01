"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Github, Headphones, Send, ShieldCheck } from "lucide-react";
import { AppShell, PageHeading } from "./app-shell";
import { DefaultAISelector } from "./default-ai-selector";
import { ProviderConnections } from "./provider-connections";

export function SettingsPanel() {
  const [tier, setTier] = useState<"free" | "pro">("free");
  const [providerRefreshKey, setProviderRefreshKey] = useState(0);
  const [settings, setSettings] = useState({
    musicStation: "Lo-Fi",
    reducedMotion: false,
  });
  const [preferences, setPreferences] = useState({
    desiredTitles: [""] as string[],
    workModes: [] as string[],
    salaryTarget: "",
    locationPreference: "",
    industries: [""] as string[],
    values: [""] as string[],
    redFlags: [""] as string[],
    weeklyPace: "",
    defaultFollowUpDays: "7",
  });
  const [tagDrafts, setTagDrafts] = useState({
    desiredTitles: "",
    industries: "",
    values: "",
    redFlags: "",
  });
  const [tagEditing, setTagEditing] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/user/tier").then(r => r.ok ? r.json() : null).then(d => { if (d?.tier) setTier(d.tier); }).catch(() => {});
    fetch("/api/settings").then(async (response) => {
      if (response.ok) {
        const body = await response.json();
        setSettings((current) => ({ ...current, ...body.settings }));
      }
    });
    fetch("/api/application-preferences").then(async (response) => {
      if (response.ok) {
        const body = await response.json();
        const desiredTitles = body.preferences.desiredTitles || [];
        const industries = body.preferences.industries || [];
        const values = body.preferences.values || [];
        const redFlags = body.preferences.redFlags || [];
        setPreferences({
          desiredTitles: desiredTitles.length ? desiredTitles : [""],
          workModes: body.preferences.workModes || [],
          salaryTarget: body.preferences.salaryTarget ? String(body.preferences.salaryTarget) : "",
          locationPreference: body.preferences.locationPreference || "",
          industries: industries.length ? industries : [""],
          values: values.length ? values : [""],
          redFlags: redFlags.length ? redFlags : [""],
          weeklyPace: body.preferences.weeklyPace ? String(body.preferences.weeklyPace) : "",
          defaultFollowUpDays: String(body.preferences.defaultFollowUpDays || 7),
        });
        setTagDrafts({
          desiredTitles: commaJoin(desiredTitles),
          industries: commaJoin(industries),
          values: commaJoin(values),
          redFlags: commaJoin(redFlags),
        });
      }
    });
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setNotice(response.ok ? "Preferences saved." : "Sign in to save preferences.");
  }

  async function feedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const raw = Object.fromEntries(new FormData(form));
    const response = await fetch("/api/github/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(raw),
    });
    const body = await response.json();
    if (response.ok) {
      form.reset();
      setNotice(`Feedback published as GitHub issue #${body.number}.`);
    } else setNotice(body.error || "Feedback could not be published.");
  }

  async function savePreferences(event: FormEvent) {
    event.preventDefault();
    const desiredTitles = parseCommaList(tagDrafts.desiredTitles);
    const industries = parseCommaList(tagDrafts.industries);
    const values = parseCommaList(tagDrafts.values);
    const redFlags = parseCommaList(tagDrafts.redFlags);
    const response = await fetch("/api/application-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        desiredTitles,
        workModes: preferences.workModes,
        salaryTarget: preferences.salaryTarget ? Number(preferences.salaryTarget) : null,
        locationPreference: preferences.locationPreference || null,
        industries,
        values,
        redFlags,
        weeklyPace: preferences.weeklyPace ? Number(preferences.weeklyPace) : null,
        defaultFollowUpDays: Number(preferences.defaultFollowUpDays || 7),
      }),
    });
    if (response.ok) {
      setPreferences((current) => ({ ...current, desiredTitles, industries, values, redFlags }));
      setTagEditing(false);
      setNotice("Tracker preferences saved.");
    } else {
      setNotice("Tracker preferences could not be saved.");
    }
  }

  function beginEditingTags() {
    setTagDrafts({
      desiredTitles: commaJoin(preferences.desiredTitles),
      industries: commaJoin(preferences.industries),
      values: commaJoin(preferences.values),
      redFlags: commaJoin(preferences.redFlags),
    });
    setTagEditing(true);
  }

  function cancelEditingTags() {
    setTagEditing(false);
  }

  return (
    <AppShell>
      <PageHeading
        eyebrow="Settings"
        title="Tune your workspace."
        copy="Connect AI providers, choose from models available to your keys, and adjust the atmosphere."
      />
      <div className="mt-7 grid items-start gap-6 lg:grid-cols-2">
        {tier === "pro" && <>
          <ProviderConnections onConnectionsChanged={() => setProviderRefreshKey((value) => value + 1)} />
          <DefaultAISelector refreshKey={providerRefreshKey} />
        </>}
        <form
          onSubmit={save}
          className="h-fit rounded-3xl border-2 border-ink bg-white p-6 shadow-[0_5px_0_#26312c]"
        >
          <h2 className="flex items-center gap-2 font-[var(--font-display)] text-xl font-black">
            <Headphones /> Atmosphere
          </h2>
          <label className="mt-4 block text-xs font-black uppercase tracking-wider text-plum">
            Default station
            <select
              value={settings.musicStation}
              onChange={(event) =>
                setSettings({ ...settings, musicStation: event.target.value })
              }
              className="mt-1 w-full rounded-2xl border-2 border-ink/15 px-3 py-3 text-sm normal-case"
            >
              {["Lo-Fi", "Ambient", "Classical", "Brain Waves"].map((station) => (
                <option key={station}>{station}</option>
              ))}
            </select>
          </label>
          <label className="mt-4 flex gap-3 rounded-2xl bg-cream p-3 text-sm font-bold">
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={(event) =>
                setSettings({ ...settings, reducedMotion: event.target.checked })
              }
              className="size-4 accent-coral"
            />
            Prefer gentler motion
          </label>
          <button className="mt-5 flex w-full justify-center gap-2 rounded-2xl border-2 border-ink bg-mint py-3 font-black shadow-[0_4px_0_#26312c]">
            <CheckCircle2 /> Save preferences
          </button>
        </form>
        <form onSubmit={savePreferences} className="rounded-3xl border-2 border-ink bg-white p-6 shadow-[0_5px_0_#26312c]">
          <h2 className="font-[var(--font-display)] text-xl font-black">Tracker preferences</h2>
          <p className="mt-2 text-sm text-ink/55">These guide Career DJ, follow-up timing, and offer comparisons.</p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-wider text-ink/55">
              {tagEditing ? "Separate each value with a comma" : "Tag lists"}
            </p>
            {!tagEditing ? (
              <button type="button" onClick={beginEditingTags} className="text-xs font-black underline decoration-coral decoration-2 underline-offset-4">
                Edit tags
              </button>
            ) : (
              <button type="button" onClick={cancelEditingTags} className="text-xs font-black underline decoration-coral decoration-2 underline-offset-4">
                Cancel
              </button>
            )}
          </div>
          <TagField
            label="Desired titles"
            editing={tagEditing}
            draft={tagDrafts.desiredTitles}
            values={preferences.desiredTitles}
            onChange={(desiredTitles) => setTagDrafts({ ...tagDrafts, desiredTitles })}
          />
          <TagField
            label="Industries"
            editing={tagEditing}
            draft={tagDrafts.industries}
            values={preferences.industries}
            onChange={(industries) => setTagDrafts({ ...tagDrafts, industries })}
          />
          <TagField
            label="Values"
            editing={tagEditing}
            draft={tagDrafts.values}
            values={preferences.values}
            onChange={(values) => setTagDrafts({ ...tagDrafts, values })}
          />
          <TagField
            label="Red flags"
            editing={tagEditing}
            draft={tagDrafts.redFlags}
            values={preferences.redFlags}
            onChange={(redFlags) => setTagDrafts({ ...tagDrafts, redFlags })}
          />
          <label className="mt-4 block text-xs font-black uppercase tracking-wider text-plum">
            Work modes
            <div className="mt-2 flex flex-wrap gap-2">
              {["remote", "hybrid", "onsite", "flexible"].map((mode) => <button type="button" key={mode} onClick={() => setPreferences((current) => ({ ...current, workModes: current.workModes.includes(mode) ? current.workModes.filter((item) => item !== mode) : [...current.workModes, mode] }))} className={`rounded-full px-3 py-1.5 text-xs font-black ${preferences.workModes.includes(mode) ? "bg-sun" : "bg-cream"}`}>{mode}</button>)}
            </div>
          </label>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input label="Salary target" value={preferences.salaryTarget} onChange={(salaryTarget) => setPreferences({ ...preferences, salaryTarget })} />
            <Input label="Location preference" value={preferences.locationPreference} onChange={(locationPreference) => setPreferences({ ...preferences, locationPreference })} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input label="Weekly pace" value={preferences.weeklyPace} onChange={(weeklyPace) => setPreferences({ ...preferences, weeklyPace })} />
            <Input label="Default follow-up days" value={preferences.defaultFollowUpDays} onChange={(defaultFollowUpDays) => setPreferences({ ...preferences, defaultFollowUpDays })} />
          </div>
          <button className="mt-5 flex w-full justify-center gap-2 rounded-2xl border-2 border-ink bg-sun py-3 font-black shadow-[0_4px_0_#26312c]">
            <CheckCircle2 /> Save tracker preferences
          </button>
        </form>
        <div className="space-y-6">
          <form onSubmit={feedback} className="rounded-3xl border-2 border-ink bg-sun/30 p-6">
            <h2 className="flex items-center gap-2 font-[var(--font-display)] text-xl font-black">
              <Github /> Shape CareerGroove
            </h2>
            <p className="mt-2 text-sm text-ink/55">
              Send feedback directly into the connected GitHub project.
            </p>
            <label className="mt-4 block text-xs font-black uppercase tracking-wider text-plum">
              Title
              <input name="title" required minLength={3} className="mt-1 w-full rounded-2xl border-2 border-ink/15 px-3 py-3 text-sm font-bold normal-case" />
            </label>
            <label className="mt-4 block text-xs font-black uppercase tracking-wider text-plum">
              Details
              <textarea name="body" required minLength={3} className="mt-1 min-h-32 w-full rounded-2xl border-2 border-ink/15 p-3 text-sm font-normal normal-case" />
            </label>
            <button className="mt-4 flex w-full justify-center gap-2 rounded-2xl border-2 border-ink bg-coral py-3 font-black shadow-[0_4px_0_#26312c]">
              <Send /> Send feedback
            </button>
          </form>
          <div className="rounded-3xl border-2 border-ink/15 bg-white/60 p-5">
            <ShieldCheck />
            <h3 className="mt-3 font-black">Your keys stay private</h3>
            <p className="mt-1 text-sm text-ink/55">
              API keys are encrypted with AES-256-GCM before storage and are only decrypted server-side when calling the selected provider.
            </p>
          </div>
          {notice && <p role="status" className="rounded-2xl bg-mint/30 p-4 text-sm font-bold">{notice}</p>}
        </div>
      </div>
    </AppShell>
  );
}

function commaJoin(values: string[]) {
  return values.filter((value) => value.trim()).join(", ");
}

function parseCommaList(text: string) {
  return Array.from(new Set(text.split(",").map((value) => value.trim()).filter(Boolean)));
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-xs font-black uppercase tracking-wider text-plum">
    {label}
    <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-2xl border-2 border-ink/15 px-3 py-3 text-sm font-bold normal-case" />
  </label>;
}

function TagField({ label, editing, draft, values, onChange }: {
  label: string; editing: boolean; draft: string; values: string[]; onChange: (text: string) => void;
}) {
  if (editing) {
    return (
      <label className="mt-4 block text-xs font-black uppercase tracking-wider text-plum">
        {label}
        <textarea
          value={draft}
          onChange={(event) => onChange(event.target.value)}
          rows={Math.max(2, Math.min(5, draft.split(",").length + 1))}
          placeholder="Separate with commas, e.g. React, TypeScript, Node"
          className="mt-1 min-h-16 w-full resize-y rounded-2xl border-2 border-ink/15 px-3 py-3 text-sm font-bold normal-case"
        />
      </label>
    );
  }
  const tags = values.filter((value) => value.trim());
  return (
    <div className="mt-4">
      <p className="text-xs font-black uppercase tracking-wider text-plum">{label}</p>
      {tags.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full bg-cream px-3 py-1.5 text-xs font-black">{tag}</span>
          ))}
        </div>
      ) : (
        <p className="mt-2 rounded-2xl border-2 border-dashed border-ink/15 bg-white/60 px-3 py-3 text-sm font-bold text-ink/45">Nothing set yet.</p>
      )}
    </div>
  );
}
