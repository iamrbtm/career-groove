"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, ChevronLeft, LoaderCircle, Pencil, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MusicPlayer } from "./music-player";
import { InferredSkill, parseChapterAI, skillCategories } from "@/lib/chapter-ai";

type Provider = "openai" | "anthropic" | "google" | "ollama";
type Connection = { provider: Provider; selectedModel: string; active: boolean };
type Answers = Record<string, string>;
type Question = { id: string; prompt: (answers: Answers) => string; type?: "date" | "yesno" };

const requiredQuestions: Question[] = [
  { id: "company", prompt: () => "What was the name of the company?" },
  { id: "title", prompt: (a) => `What was your job title at ${a.company || "the company"}?` },
  { id: "location", prompt: (a) => `Where was your role at ${a.company || "the company"} based?` },
  { id: "startedOn", prompt: (a) => `When did you start working at ${a.company || "the company"}?`, type: "date" },
  { id: "current", prompt: (a) => `Do you still work at ${a.company || "the company"}?`, type: "yesno" },
  { id: "endedOn", prompt: (a) => `When did you finish working at ${a.company || "the company"}?`, type: "date" },
  { id: "dayToDay", prompt: () => "What did you do on a typical day? Walk me through the work in your own words." },
  { id: "tools", prompt: () => "What tools, systems, equipment, or specialized skills did you use?" },
  { id: "contactName", prompt: () => "Who is the contact listed for this work-history entry?" },
  { id: "contactPhone", prompt: () => "What phone number is listed for this work-history entry?" },
];

const finalQuestion: Question = {
  id: "recognition",
  prompt: () =>
    "Were you trusted with extra duties or recognized for anything you did especially well?",
};

type InterviewPhase = "required" | "analyzing" | "probing" | "final" | "preview";

export function JobInterviewer({ jobId }: { jobId?: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [step, setStep] = useState(0);
  const [value, setValue] = useState("");
  const [provider, setProvider] = useState<Provider | "">("");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [bullets, setBullets] = useState<string[]>([]);
  const [skills, setSkills] = useState<InferredSkill[]>([]);
  const [phase, setPhase] = useState<InterviewPhase>("required");
  const [probeQuestion, setProbeQuestion] = useState("");
  const [probeQuestions, setProbeQuestions] = useState<string[]>([]);
  const [probeCount, setProbeCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [prefillLoading, setPrefillLoading] = useState(Boolean(jobId));

  const activeQuestions = useMemo(() => requiredQuestions.filter((q) => q.id !== "endedOn" || answers.current === "No"), [answers.current]);
  const question = phase === "required"
    ? activeQuestions[step]
    : phase === "probing"
      ? { id: `aiProbe${probeCount + 1}`, prompt: () => probeQuestion }
      : phase === "final"
        ? finalQuestion
        : undefined;
  const progress = Math.round((step / activeQuestions.length) * 100);
  const displayProgress = phase === "preview" ? 100 : phase === "final" ? 95 : phase === "probing" || phase === "analyzing" ? 85 : progress;
  const phaseLabel = phase === "preview" ? "Chapter preview" : phase === "analyzing" || phase === "probing" ? "AI follow-up" : phase === "final" ? "Final question" : "Required questions";

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
    if (!jobId) return;
    fetch(`/api/jobs/${jobId}`)
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok)
          throw new Error(body?.error || "This work chapter could not be loaded.");
        const job = body.job;
        const rawAnswers = Object.fromEntries(
          String(job.rawNotes || "")
            .split("\n")
            .map((line) => {
              const separator = line.indexOf(":");
              return separator > 0
                ? [line.slice(0, separator).trim(), line.slice(separator + 1).trim()]
                : ["", ""];
            })
            .filter(([key]) => key),
        ) as Answers;
        const savedAnswers =
          job.metadata?.interviewAnswers &&
          typeof job.metadata.interviewAnswers === "object"
            ? (job.metadata.interviewAnswers as Answers)
            : {};
        const prefilledAnswers = {
          ...rawAnswers,
          ...savedAnswers,
          company: job.company || "",
          title: job.title || "",
          location: job.location || "",
          startedOn: job.startedOn?.slice(0, 10) || "",
          current: job.current ? "Yes" : "No",
          endedOn: job.endedOn?.slice(0, 10) || "",
          dayToDay:
            savedAnswers.dayToDay ||
            rawAnswers.dayToDay ||
            job.rawNotes ||
            (job.achievements || []).join("\n"),
          contactName: savedAnswers.contactName || job.networkContact?.name || "None",
          contactPhone: savedAnswers.contactPhone || job.networkContact?.phone || "N/A",
        };
        setAnswers(prefilledAnswers);
        setValue(prefilledAnswers.company);
      })
      .catch((error) =>
        setNotice(error instanceof Error ? error.message : "This work chapter could not be loaded."),
      )
      .finally(() => setPrefillLoading(false));
  }, [jobId]);

  useEffect(() => {
    if ((phase === "required" || phase === "probing" || phase === "final") && question)
      setValue(answers[question.id] || "");
    inputRef.current?.focus();
  }, [step, phase, question?.id]);

  async function generatePreview(finalAnswers: Answers) {
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider || undefined, purpose: "job-interviewer", context: finalAnswers, messages: [{ role: "user", content: `Create the final resume bullets from this completed work interview. Return only one plain-text bullet per line. Interview answers: ${JSON.stringify(finalAnswers)}` }] }),
      });
      if (response.status === 401) throw new Error("Sign in to create and save your private work chapter.");
      if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error || "The chapter preview could not be created."); }
      const chapter = parseChapterAI(await response.text());
      if (!chapter.bullets.length) throw new Error("The selected model did not return usable chapter bullets.");
      setBullets(chapter.bullets);
      setSkills(chapter.skills);
      setPhase("preview");
    } catch (error) {
      const fallbackBullets = [
        finalAnswers.dayToDay,
        finalAnswers.tools,
        ...Object.entries(finalAnswers)
          .filter(([key]) => key.startsWith("aiProbe"))
          .map(([, answer]) => answer),
        finalAnswers.recognition,
      ].filter((answer): answer is string => Boolean(answer?.trim()));
      setBullets(
        fallbackBullets.length
          ? fallbackBullets
          : [`Worked as ${finalAnswers.title} at ${finalAnswers.company}.`],
      );
      setSkills([]);
      setPhase("preview");
      setNotice(
        `${error instanceof Error ? error.message : "No active AI provider could complete the request."} Your answers are preserved and you can still save this chapter.`,
      );
    }
    finally { setLoading(false); }
  }

  async function analyzeForFollowUp(currentAnswers: Answers, completedProbes: number) {
    setPhase("analyzing");
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: provider || undefined,
          purpose: "job-interview-probe",
          context: currentAnswers,
          messages: [{
            role: "user",
            content: `Review these interview answers and decide whether one additional clarifying or probing question is needed: ${JSON.stringify(currentAnswers)}`,
          }],
        }),
      });
      if (response.status === 401)
        throw new Error("Sign in to continue your private work interview.");
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "The interview analysis could not be completed.");
      }
      const raw = await response.text();
      const jsonText = raw.match(/\{[\s\S]*\}/)?.[0];
      const decision = jsonText
        ? (JSON.parse(jsonText) as { needsFollowUp?: boolean; question?: string })
        : null;
      if (
        decision?.needsFollowUp &&
        decision.question?.trim() &&
        completedProbes < 8
      ) {
        setProbeQuestion(decision.question.trim());
        setProbeQuestions((current) => {
          const next = [...current];
          next[completedProbes] = decision.question!.trim();
          return next;
        });
        setPhase("probing");
      } else {
        setPhase("final");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The interview analysis was interrupted.");
      setPhase("final");
    } finally {
      setLoading(false);
    }
  }

  function commitAnswer(answer: string) {
    if (!question || !answer.trim() || loading) return;
    const next = { ...answers, [question.id]: answer.trim() };
    setAnswers(next); setValue("");
    if (phase === "required") {
      if (step + 1 >= activeQuestions.length) void analyzeForFollowUp(next, probeCount);
      else setStep(step + 1);
    } else if (phase === "probing") {
      const nextProbeCount = probeCount + 1;
      setProbeCount(nextProbeCount);
      void analyzeForFollowUp(next, nextProbeCount);
    } else if (phase === "final") {
      void generatePreview(next);
    }
  }

  function answerQuestion(event: FormEvent) {
    event.preventDefault();
    commitAnswer(value);
  }

  function previousQuestion() {
    setNotice("");
    if (phase === "required" && step > 0) {
      setStep(step - 1);
      return;
    }
    if (phase === "probing") {
      if (probeCount > 0) {
        const previousProbe = probeCount - 1;
        setProbeCount(previousProbe);
        setProbeQuestion(probeQuestions[previousProbe] || "");
      } else {
        setStep(activeQuestions.length - 1);
        setPhase("required");
      }
      return;
    }
    if (phase === "final") {
      if (probeCount > 0) {
        const previousProbe = probeCount - 1;
        setProbeCount(previousProbe);
        setProbeQuestion(probeQuestions[previousProbe] || "");
        setPhase("probing");
      } else {
        setStep(activeQuestions.length - 1);
        setPhase("required");
      }
    }
  }

  async function submitChapter() {
    if (!bullets.length || saving) return;
    setSaving(true); setNotice("");
    try {
      const response = await fetch(jobId ? `/api/jobs/${jobId}` : "/api/jobs", { method: jobId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        company: answers.company, title: answers.title, location: answers.location,
        startedOn: answers.startedOn, endedOn: answers.current === "Yes" ? "" : answers.endedOn,
        current: answers.current === "Yes", rawNotes: Object.entries(answers).map(([key, answer]) => `${key}: ${answer}`).join("\n"),
        achievements: bullets, inferredSkills: skills, metadata: { source: jobId ? "guided-ai-reinterview" : "guided-ai-interview", interviewAnswers: answers },
        networkContact: { name: answers.contactName, phone: answers.contactPhone },
      }) });
      if (response.status === 401) throw new Error("Sign in before saving this chapter.");
      if (!response.ok) throw new Error(`We couldn’t ${jobId ? "update" : "save"} this chapter. Please try again.`);
      router.push("/journey"); router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Save failed."); setSaving(false); }
  }

  return <main className="min-h-dvh px-4 pb-28 pt-4 md:px-8 md:pt-8">
    <div className="mx-auto max-w-4xl">
      <header className="flex items-center justify-between gap-4">
        <Link href="/journey" className="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-black hover:bg-white"><ArrowLeft size={18}/> Back to journey</Link>
        <div className="rounded-full border-2 border-ink bg-white px-4 py-2 text-xs font-black uppercase tracking-widest"><span className="mr-2 text-coral">●</span>{jobId ? "Re-interview" : "Work chapter"}</div>
      </header>

      <section className="mt-6 overflow-hidden rounded-4xl border-2 border-ink bg-white shadow-pop">
        <div className="bg-ink px-6 py-5 text-cream md:px-9">
          <div className="flex items-center justify-between gap-4 text-xs font-black uppercase tracking-[.18em]"><span>{phaseLabel}</span><span className="text-mint">{phase === "preview" ? "Ready to review" : `${displayProgress}%`}</span></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-cream/15"><motion.div className="h-full rounded-full bg-coral" animate={{ width: `${displayProgress}%` }}/></div>
        </div>

        <AnimatePresence mode="wait">
          {prefillLoading ? <motion.div key="prefill" initial={{opacity:0}} animate={{opacity:1}} className="grid min-h-80 place-items-center p-10 text-center"><div><LoaderCircle className="mx-auto animate-spin text-coral" size={38}/><h1 className="mt-5 font-[var(--font-display)] text-2xl font-black">Loading your existing answers…</h1></div></motion.div> : (phase === "required" || phase === "probing" || phase === "final") && question ? <motion.form key={question.id} onSubmit={answerQuestion} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} className="p-6 md:p-10">
            <p className="text-xs font-black uppercase tracking-[.2em] text-plum">{phase === "required" ? `Required question ${step + 1} of ${activeQuestions.length}` : phase === "final" ? "Required final question" : `AI follow-up ${probeCount + 1}`}</p>
            <h1 className="mt-3 max-w-2xl font-[var(--font-display)] text-2xl font-black leading-tight md:text-4xl">{question.prompt(answers)}</h1>
            <div className="mt-8">
              {question.type === "yesno" ? <div className="grid gap-3 sm:grid-cols-2">{["Yes", "No"].map((choice) => <button type="button" key={choice} onClick={() => commitAnswer(choice)} className="rounded-2xl border-2 border-ink bg-cream px-5 py-4 text-left font-black shadow-[0_4px_0_#26312c] hover:bg-coral">{choice}</button>)}</div> : question.type === "date" ? <input ref={inputRef as React.RefObject<HTMLInputElement>} type="date" required value={value} onChange={(e) => setValue(e.target.value)} className="w-full rounded-2xl border-2 border-ink/20 bg-cream/50 p-4 text-lg font-bold outline-none focus:border-coral"/> : <textarea ref={inputRef as React.RefObject<HTMLTextAreaElement>} required value={value} onChange={(e) => setValue(e.target.value)} placeholder="Answer in your own words…" className="min-h-36 w-full resize-y rounded-3xl border-2 border-ink/20 bg-cream/50 p-4 text-base leading-7 outline-none placeholder:text-ink/30 focus:border-coral"/>}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              {(phase !== "required" || step > 0) && <button type="button" onClick={previousQuestion} className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-white px-5 py-3 font-black"><ChevronLeft size={18}/> Back</button>}
              {question.type !== "yesno" && <button disabled={!value.trim() || loading} className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-coral px-6 py-3 font-black shadow-[0_4px_0_#26312c] disabled:opacity-50">{loading ? <LoaderCircle className="animate-spin" size={18}/> : <Send size={18}/>} {phase === "final" ? "Create my chapter" : phase === "probing" || step + 1 >= activeQuestions.length ? "Continue" : "Next question"}</button>}
            </div>
          </motion.form> : phase === "analyzing" ? <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid min-h-80 place-items-center p-10 text-center"><div><LoaderCircle className="mx-auto animate-spin text-coral" size={38}/><h1 className="mt-5 font-[var(--font-display)] text-2xl font-black">Listening for the details that matter…</h1><p className="mt-2 text-sm text-ink/55">AI is reviewing your answers to see whether one useful follow-up would make this chapter clearer.</p></div></motion.div> : phase === "preview" ? <motion.div key="preview" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="p-6 md:p-10">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.2em] text-plum">Preview before submitting</p><h1 className="mt-2 font-[var(--font-display)] text-3xl font-black">{answers.title} at {answers.company}</h1><p className="mt-1 text-sm text-ink/55">{answers.location} · {answers.startedOn} – {answers.current === "Yes" ? "Present" : answers.endedOn}</p></div><Check className="text-coral" size={30}/></div>
            <div className="mt-7 space-y-3">{bullets.map((bullet, index) => <div key={index} className="flex gap-3"><span className="mt-4 size-2 shrink-0 rounded-full bg-coral"/><textarea aria-label={`Resume bullet ${index + 1}`} value={bullet} onChange={(e) => setBullets((current) => current.map((item, i) => i === index ? e.target.value : item))} className="min-h-20 w-full resize-y rounded-2xl border-2 border-ink/15 bg-mint/10 p-3 text-sm leading-6 outline-none focus:border-coral"/></div>)}</div>
            {skills.length > 0 && <div className="mt-7"><p className="text-xs font-black uppercase tracking-[.18em] text-plum">Skills discovered</p><div className="mt-3 flex flex-wrap gap-2">{skills.map((skill) => <span key={skill.name.toLocaleLowerCase()} className="rounded-full border-2 border-ink/15 bg-sun/40 px-3 py-1.5 text-sm font-bold">{skill.name} · {skillCategories[skill.category]}</span>)}</div><p className="mt-2 text-xs text-ink/50">These will be added to your Skills tab automatically.</p></div>}
            <div className="mt-7 flex flex-wrap gap-3"><button type="button" onClick={() => { setStep(0); setProbeCount(0); setPhase("required"); }} className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-white px-5 py-3 text-sm font-black"><Pencil size={17}/> Edit answers</button><button type="button" onClick={submitChapter} disabled={saving || bullets.some((item) => !item.trim())} className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-sun px-5 py-3 text-sm font-black shadow-[0_4px_0_#26312c] disabled:opacity-50">{saving ? <LoaderCircle className="animate-spin" size={17}/> : <Check size={17}/>} {saving ? (jobId ? "Updating…" : "Submitting…") : (jobId ? "Update chapter" : "Submit chapter")}</button></div>
          </motion.div> : null}
        </AnimatePresence>
        {notice && <p role="status" className="mx-6 mb-6 rounded-2xl bg-coral/15 px-4 py-3 text-sm font-bold md:mx-10">{notice} {notice.includes("provider") && <Link href="/settings" className="underline">Open Settings</Link>}</p>}
      </section>
    </div><MusicPlayer/>
  </main>;
}
