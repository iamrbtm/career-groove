"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Github, Headphones, Send, ShieldCheck } from "lucide-react";
import { AppShell, PageHeading } from "./app-shell";
import { DefaultAISelector } from "./default-ai-selector";
import { ProviderConnections } from "./provider-connections";

export function SettingsPanel() {
  const [settings, setSettings] = useState({
    musicStation: "Lo-Fi",
    reducedMotion: false,
  });
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/settings").then(async (response) => {
      if (response.ok) {
        const body = await response.json();
        setSettings((current) => ({ ...current, ...body.settings }));
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

  return (
    <AppShell>
      <PageHeading
        eyebrow="Settings"
        title="Tune your workspace."
        copy="Connect AI providers, choose from models available to your keys, and adjust the atmosphere."
      />
      <div className="mt-7 grid items-start gap-6 lg:grid-cols-2">
        <ProviderConnections />
        <DefaultAISelector />
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
