"use client";

import { CheckCircle2, Github, Globe, Linkedin, LoaderCircle, Mail, Phone, Save, ShieldCheck, Twitter, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";
import { AppShell, PageHeading } from "./app-shell";

interface Profile {
  name: string | null; email: string; phone: string;
  linkedin: string; github: string; portfolio: string;
  twitter: string; website: string; createdAt: string | Date;
}

interface ProfilePanelProps { profile: Profile }

export function ProfilePanel({ profile }: ProfilePanelProps) {
  const [name, setName] = useState(profile.name || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [linkedin, setLinkedin] = useState(profile.linkedin || "");
  const [github, setGithub] = useState(profile.github || "");
  const [portfolio, setPortfolio] = useState(profile.portfolio || "");
  const [twitter, setTwitter] = useState(profile.twitter || "");
  const [website, setWebsite] = useState(profile.website || "");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setNotice(""); setError("");
    const response = await fetch("/api/profile", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, linkedin, github, portfolio, twitter, website }),
    });
    const body = await response.json().catch(() => null);
    if (response.ok) setNotice("Profile saved."); else setError(body?.error || "Your profile could not be saved.");
    setSaving(false);
  }

  return (
    <AppShell>
      <PageHeading eyebrow="Your account" title="Profile" copy="Keep the basics behind your CareerGroove account up to date."/>
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <form onSubmit={save} className="rounded-4xl border-2 border-ink bg-white p-6 shadow-[0_6px_0_#26312c] sm:p-8">
          <div className="flex items-center gap-4">
            <div className="grid size-16 place-items-center rounded-3xl border-2 border-ink bg-coral"><UserRound size={28}/></div>
            <div><h2 className="font-[var(--font-display)] text-xl font-black">Personal details</h2><p className="text-sm text-ink/50">How you appear around the app.</p></div>
          </div>
          <label className="mt-7 block text-sm font-black">Name
            <input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required className="mt-2 w-full rounded-2xl border-2 border-ink/20 px-4 py-3 outline-none transition focus:border-coral"/>
          </label>
          <label className="mt-5 block text-sm font-black">Phone
            <div className="relative mt-2"><Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/35" size={18}/>
              <input value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" maxLength={40} placeholder="503-555-0123" className="w-full rounded-2xl border-2 border-ink/20 py-3 pl-11 pr-4 outline-none transition focus:border-coral"/>
            </div>
            <span className="mt-1.5 block text-xs font-normal text-ink/45">Used in your resume header.</span>
          </label>
          <label className="mt-5 block text-sm font-black">Email
            <div className="relative mt-2"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/35" size={18}/>
              <input value={profile.email} readOnly className="w-full rounded-2xl border-2 border-ink/10 bg-fog/50 py-3 pl-11 pr-4 text-ink/55"/>
            </div>
            <span className="mt-1.5 block text-xs font-normal text-ink/45">Your sign-in email can&rsquo;t be changed here.</span>
          </label>

          <div className="mt-8 border-t border-ink/10 pt-6">
            <h3 className="font-[var(--font-display)] text-lg font-black">Social &amp; web profiles</h3>
            <p className="mt-1 text-sm text-ink/50">Used in your resume header and AI-drafted outreach notes.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <SocialInput icon={<Linkedin size={18}/>} label="LinkedIn" value={linkedin} onChange={setLinkedin} placeholder="linkedin.com/in/yourname" />
              <SocialInput icon={<Github size={18}/>} label="GitHub" value={github} onChange={setGithub} placeholder="github.com/yourname" />
              <SocialInput icon={<Globe size={18}/>} label="Portfolio" value={portfolio} onChange={setPortfolio} placeholder="yourportfolio.dev" />
              <SocialInput icon={<Twitter size={18}/>} label="Twitter / X" value={twitter} onChange={setTwitter} placeholder="x.com/yourname" />
              <SocialInput icon={<Globe size={18}/>} label="Website" value={website} onChange={setWebsite} placeholder="yoursite.com" className="sm:col-span-2" />
            </div>
          </div>

          {notice && <p role="status" className="mt-5 flex items-center gap-2 rounded-2xl bg-mint/20 px-4 py-3 text-sm font-bold"><CheckCircle2 size={18} className="text-mint"/>{notice}</p>}
          {error && <p role="alert" className="mt-5 rounded-2xl bg-coral/15 px-4 py-3 text-sm font-bold text-coral">{error}</p>}
          <button disabled={saving} className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-ink bg-mint py-3.5 font-black shadow-[0_4px_0_#26312c] transition active:translate-y-0.5 disabled:opacity-60">
            {saving ? <LoaderCircle size={18} className="animate-spin"/> : <Save size={18}/>}
            {saving ? "Saving..." : "Save profile"}
          </button>
        </form>

        <div className="rounded-3xl border-2 border-ink/15 bg-white/60 p-6">
          <ShieldCheck size={24} className="text-plum"/>
          <h3 className="mt-4 font-black">Your data is private</h3>
          <p className="mt-2 text-sm leading-6 text-ink/55">Your profile information is only used to personalize documents, outreach drafts, and your brand profiles. We never share your data.</p>
          <p className="mt-4 text-xs text-ink/35">Member since {new Date(profile.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long" })}</p>
        </div>
      </div>
    </AppShell>
  );
}

function SocialInput({ icon, label, value, onChange, placeholder, className }: {
  icon: React.ReactNode; label: string; value: string; onChange: (v: string) => void;
  placeholder: string; className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-black uppercase tracking-[.16em] text-plum">{icon}{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} maxLength={200} placeholder={placeholder}
        className="w-full rounded-2xl border-2 border-ink/20 px-4 py-3 text-sm font-bold outline-none transition focus:border-coral"/>
    </label>
  );
}
