"use client";

import { CheckCircle2, LoaderCircle, Mail, Save, ShieldCheck, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";
import { AppShell, PageHeading } from "./app-shell";

interface Profile { name: string | null; email: string; createdAt: string | Date }
interface ProfilePanelProps { profile: Profile }

export function ProfilePanel({ profile }: ProfilePanelProps) {
  const [name, setName] = useState(profile.name || "");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setNotice(""); setError("");
    const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const body = await response.json().catch(() => null);
    if (response.ok) setNotice("Profile saved."); else setError(body?.error || "Your profile could not be saved.");
    setSaving(false);
  }

  return <AppShell><PageHeading eyebrow="Your account" title="Profile" copy="Keep the basics behind your CareerGroove account up to date."/><div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_340px]"><form onSubmit={save} className="rounded-4xl border-2 border-ink bg-white p-6 shadow-[0_6px_0_#26312c] sm:p-8"><div className="flex items-center gap-4"><div className="grid size-16 place-items-center rounded-3xl border-2 border-ink bg-coral"><UserRound size={28}/></div><div><h2 className="font-[var(--font-display)] text-xl font-black">Personal details</h2><p className="text-sm text-ink/50">How you appear around the app.</p></div></div><label className="mt-7 block text-sm font-black">Name<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required className="mt-2 w-full rounded-2xl border-2 border-ink/20 px-4 py-3 outline-none transition focus:border-coral"/></label><label className="mt-5 block text-sm font-black">Email<div className="relative mt-2"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/35" size={18}/><input value={profile.email} readOnly className="w-full rounded-2xl border-2 border-ink/10 bg-fog/50 py-3 pl-11 pr-4 text-ink/55"/></div><span className="mt-1.5 block text-xs font-normal text-ink/45">Your sign-in email can’t be changed here.</span></label>{notice && <p role="status" className="mt-5 flex items-center gap-2 rounded-2xl bg-mint/20 px-4 py-3 text-sm font-bold"><CheckCircle2 size={18}/>{notice}</p>}{error && <p role="alert" className="mt-5 rounded-2xl bg-coral/15 px-4 py-3 text-sm font-bold">{error}</p>}<button disabled={saving} className="mt-7 flex items-center gap-2 rounded-2xl border-2 border-ink bg-coral px-6 py-3 font-black shadow-pop transition active:translate-y-1 active:shadow-none disabled:opacity-60">{saving ? <LoaderCircle className="animate-spin" size={18}/> : <Save size={18}/>} {saving ? "Saving…" : "Save profile"}</button></form><aside className="rounded-4xl border-2 border-ink bg-mint/25 p-6"><ShieldCheck size={28}/><h2 className="mt-5 font-[var(--font-display)] text-xl font-black">Private by design</h2><p className="mt-2 text-sm leading-6 text-ink/60">Your career history and personal details stay tied to your account and are never published automatically.</p><p className="mt-5 border-t border-ink/15 pt-4 text-xs font-bold text-ink/45">Member since {new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(profile.createdAt))}</p></aside></div></AppShell>;
}
