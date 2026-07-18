import { FileText, MessageCircleMore, Network, type LucideIcon } from "lucide-react";
import { Reveal } from "./reveal";

interface Feature { icon: LucideIcon; eyebrow: string; title: string; copy: string; color: string }

const features: Feature[] = [
  { icon: Network, eyebrow: "Career CRM", title: "Remember every chapter.", copy: "Keep roles, projects, people, skills, and wins in one living timeline—ready whenever opportunity knocks.", color: "bg-mint" },
  { icon: FileText, eyebrow: "AI documents", title: "Tailor without starting over.", copy: "Turn your real experience into focused resumes and cover letters that sound like you, not a template.", color: "bg-coral" },
  { icon: MessageCircleMore, eyebrow: "Interview prep", title: "Practice with your own story.", copy: "Rehearse the questions that matter with an interviewer that already understands your background.", color: "bg-sun" },
];

export function Features() {
  return <section id="features" className="border-y-2 border-ink bg-ink px-5 py-20 text-cream lg:px-8 lg:py-28"><div className="mx-auto max-w-7xl"><Reveal><p className="text-xs font-black uppercase tracking-[.22em] text-mint">One home for your whole career</p><h2 className="mt-3 max-w-3xl font-[var(--font-display)] text-4xl font-black leading-tight sm:text-5xl">Stop rebuilding your story every time you need it.</h2></Reveal><div className="mt-12 grid gap-5 lg:grid-cols-3">{features.map(({ icon: Icon, ...feature }, index) => <Reveal key={feature.title} delay={index * .1} className="h-full"><article className="h-full rounded-4xl border-2 border-cream/20 bg-cream/[.06] p-6 transition hover:-translate-y-1 hover:border-cream/50 sm:p-8"><div className={`grid size-14 place-items-center rounded-2xl border-2 border-cream ${feature.color} text-ink`}><Icon size={26}/></div><p className="mt-7 text-xs font-black uppercase tracking-[.2em] text-mint">{feature.eyebrow}</p><h3 className="mt-2 font-[var(--font-display)] text-2xl font-black">{feature.title}</h3><p className="mt-3 leading-7 text-cream/65">{feature.copy}</p></article></Reveal>)}</div></div></section>;
}

export function HowItWorks() {
  const steps = ["Talk it out", "Find the signal", "Make your next move"];
  return <section id="how-it-works" className="px-5 py-20 lg:px-8 lg:py-28"><div className="mx-auto max-w-7xl"><Reveal className="text-center"><p className="text-xs font-black uppercase tracking-[.22em] text-plum">No blank-page panic</p><h2 className="mt-3 font-[var(--font-display)] text-4xl font-black sm:text-5xl">From memory to momentum.</h2></Reveal><div className="mt-12 grid gap-4 md:grid-cols-3">{steps.map((step, index) => <Reveal key={step} delay={index * .1}><div className="relative rounded-3xl border-2 border-ink bg-white/60 p-6 shadow-soft"><span className="grid size-10 place-items-center rounded-full border-2 border-ink bg-sun font-black">{index + 1}</span><h3 className="mt-5 font-[var(--font-display)] text-xl font-black">{step}</h3><p className="mt-2 text-sm leading-6 text-ink/60">{index === 0 ? "Answer friendly prompts in your own words. Messy is welcome." : index === 1 ? "CareerGroove shapes the details into clear, credible achievements." : "Generate tailored materials and walk into interviews prepared."}</p></div></Reveal>)}</div></div></section>;
}
