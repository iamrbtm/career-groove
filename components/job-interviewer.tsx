"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, LoaderCircle, Mic2, Save, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { MusicPlayer } from "./music-player";

type Provider = "openai" | "anthropic" | "google" | "ollama";
type Connection = { provider: Provider; selectedModel: string; active: boolean };
const providerNames: Record<Provider,string> = {openai:"OpenAI",anthropic:"Claude",google:"Gemini",ollama:"Ollama"};

const prompts = [
  "What did you own day to day?",
  "What got measurably better because of your work?",
  "Who did you collaborate with, and how?",
];

export function JobInterviewer() {
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [answer, setAnswer] = useState("");
  const [provider, setProvider] = useState<Provider | "">("");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(()=>{fetch("/api/providers").then(async response=>{if(!response.ok)return;const active=((await response.json()).connections as Connection[]).filter(connection=>connection.active&&connection.selectedModel);setConnections(active);setProvider(current=>current||active[0]?.provider||"")}).catch(()=>undefined)},[]);

  const achievements = useMemo(() => answer.split("\n").map((line) => line.replace(/^\s*[-*•\d.)]+\s*/, "").trim()).filter((line) => line.length > 12), [answer]);

  async function interview(event: FormEvent) {
    event.preventDefault();
    if (!story.trim() || loading || !provider) return;
    setLoading(true); setAnswer(""); setNotice("");
    try {
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        provider, purpose: "job-interviewer", context: { company, title },
        messages: [{ role: "user", content: `Here is my rough account of the role:\n${story}\n\nReturn 3–5 strong bullets, then one focused follow-up question if useful.` }],
      }) });
      if (response.status === 401) throw new Error("Sign in to start an AI interview and keep your career data private.");
      if (!response.ok || !response.body) throw new Error((await response.text()) || "The interview could not start.");
      const reader = response.body.getReader(); const decoder = new TextDecoder();
      while (true) { const { done, value } = await reader.read(); if (done) break; setAnswer((current) => current + decoder.decode(value, { stream: true })); }
    } catch (error) { setNotice(error instanceof Error ? error.message : "Something interrupted the session."); }
    finally { setLoading(false); }
  }

  async function save() {
    if (!company.trim() || !title.trim() || !answer.trim()) { setNotice("Add a company and title, then generate your bullets first."); return; }
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company, title, rawNotes: story, achievements, current: false, metadata: { source: "ai-job-interviewer", provider } }) });
      if (response.status === 401) throw new Error("Sign in before saving this chapter to your career history.");
      if (!response.ok) throw new Error("We couldn’t save this chapter. Check the role details and try again.");
      setNotice("Saved to your career history. Nice work.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Save failed."); }
    finally { setSaving(false); }
  }

  return <main className="min-h-dvh px-4 pb-28 pt-4 md:px-8 md:pt-8">
    <div className="mx-auto max-w-6xl">
      <header className="flex items-center justify-between gap-4"><Link href="/" className="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-black hover:bg-white"><ArrowLeft size={18}/> Back home</Link><div className="rounded-full border-2 border-ink bg-white px-4 py-2 text-xs font-black uppercase tracking-widest"><span className="mr-2 text-coral">●</span>AI Interviewer</div></header>
      <section className="mt-6 grid overflow-hidden rounded-4xl border-2 border-ink bg-white shadow-pop lg:grid-cols-[.75fr_1.25fr]">
        <aside className="relative overflow-hidden bg-ink p-6 text-cream md:p-9"><div className="absolute -right-14 -top-14 size-44 rounded-full border-[22px] border-coral/25"/><div className="relative"><div className="grid size-14 place-items-center rounded-2xl border-2 border-cream bg-coral text-ink"><Mic2 size={26}/></div><p className="mt-8 text-xs font-black uppercase tracking-[.22em] text-mint">No perfect wording required</p><h1 className="mt-2 font-[var(--font-display)] text-3xl font-black md:text-4xl">Talk messy.<br/><span className="text-sun">Leave polished.</span></h1><p className="mt-4 text-sm leading-6 text-cream/65">Tell us what actually happened. The interviewer will surface impact without inventing a thing.</p><div className="mt-9 space-y-4">{prompts.map((prompt, i) => <div key={prompt} className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-cream/10 text-xs font-black text-sun">{i + 1}</span><p className="text-sm text-cream/75">{prompt}</p></div>)}</div></div></aside>
        <form onSubmit={interview} className="p-5 md:p-9"><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-black uppercase tracking-wider text-plum">Company<input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Studio" className="mt-2 w-full rounded-2xl border-2 border-ink/15 px-4 py-3 text-base font-bold normal-case tracking-normal outline-none focus:border-coral"/></label><label className="text-xs font-black uppercase tracking-wider text-plum">Your title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Product Designer" className="mt-2 w-full rounded-2xl border-2 border-ink/15 px-4 py-3 text-base font-bold normal-case tracking-normal outline-none focus:border-coral"/></label></div>
          <div className="mt-5 flex items-center justify-between gap-3"><label htmlFor="story" className="text-xs font-black uppercase tracking-wider text-plum">What happened there?</label>{connections.length?<select value={provider} onChange={(e) => setProvider(e.target.value as Provider)} aria-label="AI provider" className="max-w-56 rounded-xl border border-ink/15 bg-cream px-3 py-2 text-xs font-bold">{connections.map(connection=><option key={connection.provider} value={connection.provider}>{providerNames[connection.provider]} · {connection.selectedModel}</option>)}</select>:<Link href="/settings" className="rounded-xl bg-sun px-3 py-2 text-xs font-black">Connect an AI provider</Link>}</div>
          <textarea id="story" required value={story} onChange={(e) => setStory(e.target.value)} placeholder="I joined when the support queue was a mess. I rebuilt the triage process, worked with engineering on the recurring bugs, and I think response time dropped by about half…" className="mt-2 min-h-44 w-full resize-y rounded-3xl border-2 border-ink/15 bg-cream/40 p-4 leading-6 outline-none placeholder:text-ink/35 focus:border-coral"/>
          <button disabled={loading || !story.trim() || !provider} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-coral py-3 font-black shadow-pop transition disabled:cursor-not-allowed disabled:opacity-50">{loading ? <><LoaderCircle className="animate-spin" size={18}/> Listening…</> : <><Sparkles size={18}/>{provider?"Find the strongest notes":"Connect a provider in Settings"}<Send size={17}/></>}</button>
          <AnimatePresence mode="wait">{answer && <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-7 rounded-3xl border-2 border-ink bg-mint/20 p-5"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-plum"><Check size={16}/> Your polished take</div><div className="mt-4 whitespace-pre-wrap text-sm leading-6">{answer}</div><button type="button" onClick={save} disabled={saving} className="mt-5 flex items-center gap-2 rounded-2xl border-2 border-ink bg-sun px-4 py-3 text-sm font-black shadow-[0_4px_0_#26312c] disabled:opacity-60"><Save size={17}/>{saving ? "Saving…" : "Save this chapter"}</button></motion.div>}</AnimatePresence>
          {notice && <p role="status" className={`mt-4 rounded-2xl px-4 py-3 text-sm font-bold ${notice.startsWith("Saved") ? "bg-mint/30" : "bg-coral/15"}`}>{notice}{notice.startsWith("Sign in") && <> <Link href="/signin" className="underline">Sign in</Link></>}</p>}
        </form>
      </section>
    </div><MusicPlayer />
  </main>;
}
