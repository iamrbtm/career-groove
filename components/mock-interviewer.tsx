"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell, PageHeading } from "./app-shell";
import { LoaderCircle, Send, Sparkles } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

export function MockInterviewer() {
  const searchParams = useSearchParams();
  const applicationId = searchParams.get("applicationId");
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: "Tell me the role you are preparing for, paste the job description if you have it, and I will lead the interview." }]);
  const [input, setInput] = useState("");
  const [jobs, setJobs] = useState<any[]>([]);
  const [applicationContext, setApplicationContext] = useState<any>(null);
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(false);
  const [briefLoading, setBriefLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/jobs").then((response) => response.ok ? response.json() : { jobs: [] }).then((body) => setJobs(body.jobs || [])).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!applicationId) return;
    fetch(`/api/applications/${applicationId}`, { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const body = await response.json();
      setApplicationContext(body);
      setMessages([{ role: "assistant", content: `Soundcheck loaded for ${body.application.title} at ${body.application.company}. Start with the interview round or paste a question you want to practice.` }]);
    }).catch(() => undefined);
  }, [applicationId]);

  async function generateBrief() {
    if (!applicationContext) return;
    setBriefLoading(true);
    setError("");
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: "soundcheck-brief",
          context: { ...applicationContext, jobHistory: jobs },
          messages: [{ role: "user", content: "Create a concise role-specific interview prep brief." }],
        }),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(text || "Brief could not be generated.");
      setBrief(text);
    } catch (event) {
      setError(event instanceof Error ? event.message : "Brief could not be generated.");
    } finally {
      setBriefLoading(false);
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!input.trim() || loading) return;
    const next = [...messages, { role: "user" as const, content: input }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "mock-interview", context: { jobHistory: jobs, application: applicationContext, brief }, messages: next.map((message) => ({ role: message.role, content: message.content })) }),
      });
      if (response.status === 401) throw new Error("Sign in to begin a private mock interview.");
      if (!response.ok || !response.body) throw new Error("The interviewer is unavailable. Check your AI settings.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      setMessages([...next, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setMessages([...next, { role: "assistant", content: text }]);
      }
    } catch (event) {
      setError(event instanceof Error ? event.message : "Interview failed.");
    } finally {
      setLoading(false);
    }
  }

  return <AppShell>
    <PageHeading eyebrow={applicationContext ? "Application Soundcheck" : "Reverse mock interviewer"} title={applicationContext ? `${applicationContext.application.title} soundcheck` : "Practice with your real story."} copy={applicationContext ? `Prep is grounded in ${applicationContext.application.company}, the saved role, research notes, interviews, and linked materials.` : "CareerGroove uses your saved experience to ask sharper questions and coach answers grounded in what you have actually done."} />
    <section className="mt-7 grid gap-5 lg:grid-cols-[.65fr_1.35fr]">
      <aside className="rounded-3xl border-2 border-ink bg-sun/40 p-6">
        <Sparkles />
        <h2 className="mt-5 font-[var(--font-display)] text-2xl font-black">Context loaded</h2>
        <p className="mt-2 text-sm text-ink/60">{applicationContext ? `${applicationContext.application.company} role context is ready.` : jobs.length ? `${jobs.length} work chapter${jobs.length === 1 ? "" : "s"} ready for the interviewer.` : "Add work chapters in Journey for more specific coaching."}</p>
        {applicationContext && <button onClick={() => void generateBrief()} disabled={briefLoading} className="mt-4 rounded-2xl border-2 border-ink bg-white px-4 py-2.5 text-sm font-black disabled:opacity-60">{briefLoading ? "Building brief..." : "Build prep brief"}</button>}
        {brief && <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-2xl bg-white/70 p-4 text-xs leading-5">{brief}</pre>}
        {!applicationContext && jobs.slice(0, 4).map((job) => <div key={job.id} className="mt-4 rounded-2xl bg-white/60 p-3"><p className="text-sm font-black">{job.title}</p><p className="text-xs text-ink/50">{job.company}</p></div>)}
      </aside>
      <div className="flex min-h-[560px] flex-col rounded-3xl border-2 border-ink bg-white p-4 shadow-[0_5px_0_#26312c]">
        <div className="flex-1 space-y-4 overflow-auto p-2">{messages.map((message, index) => <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-coral text-ink" : "bg-cream"}`}>{message.content || "Thinking..."}</div></div>)}</div>
        {error && <p className="mb-2 rounded-xl bg-coral/15 p-3 text-sm font-bold">{error}</p>}
        <form onSubmit={send} className="flex gap-2 border-t-2 border-ink/10 pt-3">
          <textarea aria-label="Your answer" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Type your answer..." className="min-h-14 flex-1 resize-none rounded-2xl bg-cream px-4 py-3 outline-none" />
          <button disabled={loading} className="grid size-14 place-items-center rounded-2xl border-2 border-ink bg-mint shadow-[0_3px_0_#26312c]">{loading ? <LoaderCircle className="animate-spin" /> : <Send size={19} />}</button>
        </form>
      </div>
    </section>
  </AppShell>;
}
