"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import Link from "next/link";

export function Hero() {
  const reduceMotion = useReducedMotion();
  return (
    <section className="relative overflow-hidden px-5 pb-20 pt-16 sm:pt-24 lg:px-8 lg:pb-28">
      <div className="absolute left-[8%] top-14 -z-10 size-44 rounded-full bg-sun/25 blur-3xl" />
      <div className="absolute right-[5%] top-36 -z-10 size-64 rounded-full bg-mint/25 blur-3xl" />
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
        <motion.div initial={reduceMotion ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="inline-flex items-center gap-2 rounded-full border-2 border-ink/15 bg-white/70 px-4 py-2 text-xs font-black uppercase tracking-[.16em] text-plum"><Sparkles size={15} /> Your experience, amplified</div>
          <h1 className="mt-6 max-w-3xl font-[var(--font-display)] text-5xl font-black leading-[.98] tracking-[-.04em] sm:text-6xl lg:text-7xl">Turn rough career stories into <span className="relative inline-block text-coral">standout wins.<svg aria-hidden="true" className="absolute -bottom-2 left-0 w-full text-sun" viewBox="0 0 300 14" fill="none"><path d="M3 10C75 1 196 2 297 8" stroke="currentColor" strokeWidth="7" strokeLinecap="round"/></svg></span></h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-ink/65">CareerGroove remembers what you’ve done, finds the strongest signal, and turns it into tailored applications and confident interviews.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="#pricing" className="group flex items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-coral px-6 py-4 font-black shadow-pop transition active:translate-y-1 active:shadow-none">Build my career story <ArrowRight className="transition group-hover:translate-x-1" size={19}/></Link><Link href="#how-it-works" className="flex items-center justify-center rounded-2xl border-2 border-ink/20 bg-white/60 px-6 py-4 font-black hover:border-ink">See how it works</Link></div>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-ink/60">{["Start in minutes", "Cancel anytime", "Your data stays yours"].map(item => <span key={item} className="flex items-center gap-1.5"><Check className="text-mint" strokeWidth={4} size={16}/>{item}</span>)}</div>
        </motion.div>
        <motion.div initial={reduceMotion ? false : { opacity: 0, scale: .94, rotate: 2 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ duration: .7, delay: .15 }} className="relative mx-auto w-full max-w-xl">
          <div className="absolute -left-5 -top-5 size-20 rounded-3xl border-2 border-ink bg-sun" />
          <div className="relative rounded-4xl border-2 border-ink bg-white p-5 shadow-[10px_12px_0_#26312c] sm:p-7">
            <div className="flex items-center justify-between border-b-2 border-ink/10 pb-4"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-plum">Story session</p><p className="font-[var(--font-display)] text-xl font-black">Find the win in the work</p></div><span className="grid size-10 place-items-center rounded-2xl bg-mint">♪</span></div>
            <div className="mt-5 rounded-3xl rounded-bl-md bg-fog/70 p-4 text-sm leading-6 text-ink/70">I helped onboard the new team, but it was mostly just making docs and answering questions...</div>
            <div className="ml-6 mt-4 rounded-3xl rounded-br-md border-2 border-ink bg-ink p-5 text-cream"><p className="text-xs font-black uppercase tracking-[.15em] text-mint">Achievement found</p><p className="mt-2 font-[var(--font-display)] text-lg font-black">Built a repeatable onboarding system that accelerated team ramp-up.</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-cream/15"><motion.div initial={{ width: 0 }} whileInView={{ width: "88%" }} viewport={{ once: true }} transition={{ duration: 1, delay: .5 }} className="h-full rounded-full bg-coral" /></div><p className="mt-2 text-xs text-cream/55">Strong impact signal · ready to tailor</p></div>
            <div className="mt-5 flex gap-3"><div className="h-10 flex-1 rounded-2xl bg-fog"/><div className="size-10 rounded-2xl border-2 border-ink bg-coral"/></div>
          </div>
          <div className="absolute -bottom-8 -right-3 rotate-3 rounded-2xl border-2 border-ink bg-sun px-4 py-3 text-sm font-black shadow-[4px_4px_0_#26312c] sm:right-2">From “just helped” → real impact ✦</div>
        </motion.div>
      </div>
    </section>
  );
}
