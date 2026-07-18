"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, LoaderCircle, Pencil, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MusicPlayer } from "./music-player";
import { InferredSkill, parseChapterAI, skillCategories } from "@/lib/chapter-ai";

type Provider = "openai" | "anthropic" | "google" | "ollama";
type Connection = { provider: Provider; selectedModel: string; active: boolean };
type Answers = Record<string, string>;
type Question = { id: string; prompt: (answers: Answers) => string; type?: "date" | "yesno" };

const questions: Question[] = [
  { id: "company", prompt: () => "What was the name of the company?" },
  { id: "title", prompt: (a) => `What was your job title at ${a.company || "the company"}?` },
  { id: "location", prompt: (a) => `Where was your role at ${a.company || "the company"} based?` },
  { id: "startedOn", prompt: (a) => `When did you start working at ${a.company || "the company"}?`, type: "date" },
  { id: "current", prompt: (a) => `Do you still work at ${a.company || "the company"}?`, type: "yesno" },
  { id: "endedOn", prompt: (a) => `When did you finish working at ${a.company || "the company"}?`, type: "date" },
  { id: "dayToDay", prompt: () => "What did you do on a typical day? Walk me through the work in your own words." },
  { id: "responsibilities", prompt: () => "What responsibilities did people rely on you to handle?" },
  { id: "impact", prompt: () => "What became faster, easier, safer, more accurate, or more successful because of your work?" },
  { id: "collaboration", prompt: () => "Who did you work with, and how did you help customers, coworkers, or the team?" },
  { id: "tools", prompt: () => "What tools, systems, equipment, or specialized skills did you use?" },
  { id: "recognition", prompt: () => "Were you trusted with extra duties or recognized for anything you did especially well?" },
];

export function JobInterviewer() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [step, setStep] = useState(0);
  const [value, setValue] = useState("");
  const [provider, setProvider] = useState<Provider | "">("");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [bullets, setBullets] = useState<string[]>([]);
  const [skills, setSkills] = useState<InferredSkill[]>([]);
  const [phase, setPhase] = useState<"interview" | "preview">("interview");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const activeQuestions = useMemo(() => questions.filter((q) => q.id !== "endedOn" || answers.current === "No"), [answers.current]);
  const question = activeQuestions[step];
  const progress = Math.round((step / activeQuestions.length) * 100);

  useEffect(() => {
    fetch("/api/providers").then(async (response) => {
      if (!response.ok) return;
      const body = await response.json();
      const active = (body.connections as Connection[]).filter((item) => item.active && item.selectedModel);
      setConnections(active);
      setProvider(active.some((item) => item.provider === body.defaultProvider) ? body.defaultProvider : active[0]?.provider || "");
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (phase === "interview" && question) setValue(answers[question.id] || "");
    inputRef.current?.focus();
  }, [step, phase, question?.id]);

  async function generatePreview(finalAnswers: Answers) {
    if (!provider) { setNotice("Connect an AI provider in Settings to finish this chapter."); return; }
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, purpose: "job-interviewer", context: finalAnswers, messages: [{ role: "user", content: `Create the final resume bullets from this completed work interview. Return only one plain-text bullet per line. Interview answers: ${JSON.stringify(finalAnswers)}` }] }),
      });
      if (response.status === 401) throw new Error("Sign in to create and save your private work chapter.");
      if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error || "The chapter preview could not be created."); }
      const chapter = parseChapterAI(await response.text());
      if (!chapter.bullets.length) throw new Error("The selected model did not return usable chapter bullets.");
      setBullets(chapter.bullets);
      setSkills(chapter.skills);
      setPhase("preview");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Something interrupted the interview."); }
    finally { setLoading(false); }
  }

  function commitAnswer(answer: string) {
    if (!question || !answer.trim() || loading) return;
    const next = { ...answers, [question.id]: answer.trim() };
    setAnswers(next); setValue("");
    if (step + 1 >= activeQuestions.length) void generatePreview(next);
    else setStep(step + 1);
  }

  function answerQuestion(event: FormEvent) {
    event.preventDefault();
    commitAnswer(value);
  }

  async function submitChapter() {
    if (!bullets.length || saving) return;
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        company: answers.company, title: answers.title, location: answers.location,
        startedOn: answers.startedOn, endedOn: answers.current === "Yes" ? "" : answers.endedOn,
        current: answers.current === "Yes", rawNotes: Object.entries(answers).map(([key, answer]) => `${key}: ${answer}`).join("\n"),
        achievements: bullets, inferredSkills: skills, metadata: { source: "guided-ai-interview", interviewAnswers: answers },
      }) });
      if (response.status === 401) throw new Error("Sign in before saving this chapter.");
      if (!response.ok) throw new Error("We couldn’t save this chapter. Please try again.");
      router.push("/journey"); router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Save failed."); setSaving(false); }
  }

  return <main className="min-h-dvh px-4 pb-28 pt-4 md:px-8 md:pt-8">
    <div className="mx-auto max-w-4xl">
      <header className="flex items-center justify-between gap-4">
        <Link href="/journey" className="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-black hover:bg-white"><ArrowLeft size={18}/> Back to journey</Link>
        <div className="rounded-full border-2 border-ink bg-white px-4 py-2 text-xs font-black uppercase tracking-widest"><span className="mr-2 text-coral">●</span>Work chapter</div>
      </header>

      <section className="mt-6 overflow-hidden rounded-4xl border-2 border-ink bg-white shadow-pop">
        <div className="bg-ink px-6 py-5 text-cream md:px-9">
          <div className="flex items-center justify-between gap-4 text-xs font-black uppercase tracking-[.18em]"><span>{phase === "interview" ? "Tell your story" : "Chapter preview"}</span><span className="text-mint">{phase === "preview" ? "Ready to review" : `${progress}%`}</span></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-cream/15"><motion.div className="h-full rounded-full bg-coral" animate={{ width: phase === "preview" ? "100%" : `${progress}%` }}/></div>
        </div>

        <AnimatePresence mode="wait">
          {phase === "interview" && question ? <motion.form key={question.id} onSubmit={answerQuestion} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} className="p-6 md:p-10">
            <p className="text-xs font-black uppercase tracking-[.2em] text-plum">Question {step + 1} of {activeQuestions.length}</p>
            <h1 className="mt-3 max-w-2xl font-[var(--font-display)] text-2xl font-black leading-tight md:text-4xl">{question.prompt(answers)}</h1>
            <div className="mt-8">
              {question.type === "yesno" ? <div className="grid gap-3 sm:grid-cols-2">{["Yes", "No"].map((choice) => <button type="button" key={choice} onClick={() => commitAnswer(choice)} className="rounded-2xl border-2 border-ink bg-cream px-5 py-4 text-left font-black shadow-[0_4px_0_#26312c] hover:bg-coral">{choice}</button>)}</div> : question.type === "date" ? <input ref={inputRef as React.RefObject<HTMLInputElement>} type="date" required value={value} onChange={(e) => setValue(e.target.value)} className="w-full rounded-2xl border-2 border-ink/20 bg-cream/50 p-4 text-lg font-bold outline-none focus:border-coral"/> : <textarea ref={inputRef as React.RefObject<HTMLTextAreaElement>} required value={value} onChange={(e) => setValue(e.target.value)} placeholder="Answer in your own words…" className="min-h-36 w-full resize-y rounded-3xl border-2 border-ink/20 bg-cream/50 p-4 text-base leading-7 outline-none placeholder:text-ink/30 focus:border-coral"/>}
            </div>
            {question.type !== "yesno" && <button disabled={!value.trim() || loading} className="mt-5 flex items-center gap-2 rounded-2xl border-2 border-ink bg-coral px-6 py-3 font-black shadow-[0_4px_0_#26312c] disabled:opacity-50">{loading ? <LoaderCircle className="animate-spin" size={18}/> : <Send size={18}/>} {step + 1 === activeQuestions.length ? "Create my chapter" : "Next question"}</button>}
            {loading && <p className="mt-4 flex items-center gap-2 text-sm font-bold text-plum"><Sparkles size={17}/> Turning your interview into a chapter…</p>}
          </motion.form> : phase === "preview" ? <motion.div key="preview" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="p-6 md:p-10">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.2em] text-plum">Preview before submitting</p><h1 className="mt-2 font-[var(--font-display)] text-3xl font-black">{answers.title} at {answers.company}</h1><p className="mt-1 text-sm text-ink/55">{answers.location} · {answers.startedOn} – {answers.current === "Yes" ? "Present" : answers.endedOn}</p></div><Check className="text-coral" size={30}/></div>
            <div className="mt-7 space-y-3">{bullets.map((bullet, index) => <div key={index} className="flex gap-3"><span className="mt-4 size-2 shrink-0 rounded-full bg-coral"/><textarea aria-label={`Resume bullet ${index + 1}`} value={bullet} onChange={(e) => setBullets((current) => current.map((item, i) => i === index ? e.target.value : item))} className="min-h-20 w-full resize-y rounded-2xl border-2 border-ink/15 bg-mint/10 p-3 text-sm leading-6 outline-none focus:border-coral"/></div>)}</div>
            {skills.length > 0 && <div className="mt-7"><p className="text-xs font-black uppercase tracking-[.18em] text-plum">Skills discovered</p><div className="mt-3 flex flex-wrap gap-2">{skills.map((skill) => <span key={skill.name.toLocaleLowerCase()} className="rounded-full border-2 border-ink/15 bg-sun/40 px-3 py-1.5 text-sm font-bold">{skill.name} · {skillCategories[skill.category]}</span>)}</div><p className="mt-2 text-xs text-ink/50">These will be added to your Skills tab automatically.</p></div>}
            <div className="mt-7 flex flex-wrap gap-3"><button type="button" onClick={() => { setStep(0); setPhase("interview"); }} className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-white px-5 py-3 text-sm font-black"><Pencil size={17}/> Edit answers</button><button type="button" onClick={submitChapter} disabled={saving || bullets.some((item) => !item.trim())} className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-sun px-5 py-3 text-sm font-black shadow-[0_4px_0_#26312c] disabled:opacity-50">{saving ? <LoaderCircle className="animate-spin" size={17}/> : <Check size={17}/>} {saving ? "Submitting…" : "Submit chapter"}</button></div>
          </motion.div> : null}
        </AnimatePresence>
        {notice && <p role="status" className="mx-6 mb-6 rounded-2xl bg-coral/15 px-4 py-3 text-sm font-bold md:mx-10">{notice} {notice.includes("provider") && <Link href="/settings" className="underline">Open Settings</Link>}</p>}
      </section>
    </div><MusicPlayer/>
  </main>;
}
