"use client";
import { motion } from "framer-motion";
import { ArrowUpRight, BarChart3, BriefcaseBusiness, ClipboardList, FileText, Home, Mail, MessageCircleMore, Network, Palette, Plus, Settings2, Sparkles } from "lucide-react";
import { MotionButton } from "./motion-button";
import { MusicPlayer } from "./music-player";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountMenu } from "./account-menu";

const tools = [
  { icon: ClipboardList, title: "Run today's setlist", copy: "Pick one saved role, see the next move, and keep the search calm.", color: "bg-mint", tag: "Command Session", href: "/applications" },
  { icon: MessageCircleMore, title: "Tell your story", copy: "Rambling welcome. We'll find the strongest bullets.", color: "bg-coral", tag: "AI Interviewer", href: "/interview" },
  { icon: Mail, title: "Track follow-ups", copy: "Overdue nudges, upcoming check-ins, and AI-drafted outreach.", color: "bg-sun", tag: "Follow-ups", href: "/follow-ups" },
  { icon: Palette, title: "Polish your brand", copy: "Optimize LinkedIn, GitHub, and your personal story with AI.", color: "bg-lilac/40", tag: "Brand Studio", href: "/brand" },
  { icon: Sparkles, title: "Practice the room", copy: "A mock interview that already knows your history.", color: "bg-sun", tag: "Interview Prep", href: "/mock-interview" },
  { icon: FileText, title: "Make it shine", copy: "Shape a tailored resume or cover letter in a few beats.", color: "bg-mint", tag: "Documents", href: "/documents" },
  { icon: BarChart3, title: "Read the signal", copy: "See source quality, follow-up health, and what to adjust next.", color: "bg-lilac/40", tag: "Analytics", href: "/analytics" },
];
const nav = [
  { icon: Home, name: "Home", href: "/dashboard" },
  { icon: BriefcaseBusiness, name: "Journey", href: "/journey" },
  { icon: ClipboardList, name: "Applications", href: "/applications" },
  { icon: Mail, name: "Follow-ups", href: "/follow-ups" },
  { icon: BarChart3, name: "Analytics", href: "/analytics" },
  { icon: Network, name: "Network", href: "/network" },
  { icon: FileText, name: "Documents", href: "/documents" },
  { icon: Palette, name: "Brand", href: "/brand" },
  { icon: Settings2, name: "Settings", href: "/settings" },
];

export function Dashboard() {
  const router = useRouter();
  const today = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  const [recentJobs, setRecentJobs] = useState<Array<{id:string;title:string;company:string}>>([]);
  const [applications, setApplications] = useState<Array<{id:string;title:string;company:string;priorityLabel:string|null;followUpDueAt:string|null;status:string}>>([]);
  const [session, setSession] = useState<{title:string;actions:Array<{id:string;title:string;reason:string;routeTarget:string;status:string}>} | null>(null);
  const [overdueCount, setOverdueCount] = useState(0);
  useEffect(()=>{fetch("/api/jobs").then(async r=>{if(r.ok)setRecentJobs((await r.json()).jobs.slice(0,2))}).catch(()=>undefined)},[]);
  useEffect(()=>{fetch("/api/applications").then(async r=>{if(r.ok)setApplications((await r.json()).applications.slice(0,4))}).catch(()=>undefined); fetch("/api/command-sessions").then(async r=>{if(r.ok)setSession((await r.json()).session||null)}).catch(()=>undefined); fetch("/api/follow-ups/overdue").then(async r=>{if(r.ok)setOverdueCount((await r.json()).totalOverdue)}).catch(()=>undefined)},[]);
  return <div className="min-h-dvh pb-28 md:pb-8">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-24 flex-col items-center border-r-2 border-ink/10 bg-ink py-7 text-cream md:flex">
      <div className="grid size-12 place-items-center rounded-2xl bg-coral text-xl font-black shadow-[0_4px_0_#ffc857]">CG</div>
      <nav className="mt-16 flex flex-1 flex-col gap-7">{nav.map(({ icon: Icon, name, href }, i) => <button onClick={()=>router.push(href)} key={name} aria-label={name} className={`grid size-12 place-items-center rounded-2xl ${i === 0 ? "bg-cream text-ink" : "text-cream/60 hover:text-cream"}`}><Icon size={21} /></button>)}</nav>
      <AccountMenu />
    </aside>

    <main className="mx-auto max-w-7xl px-5 pt-6 md:pl-32 md:pr-10 md:pt-10">
      <header className="flex items-center justify-between">
        <div><p className="text-xs font-black uppercase tracking-[.24em] text-plum">{today}</p><h1 className="mt-1 font-[var(--font-display)] text-2xl font-black md:text-3xl">Hey, you. <span className="inline-block origin-bottom -rotate-3">✦</span></h1></div>
        <MotionButton onClick={()=>router.push("/journey")} className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-coral px-4 py-3 text-sm font-black shadow-pop"><Plus size={18} /> <span className="hidden sm:inline">Add a chapter</span></MotionButton>
      </header>

      <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="relative mt-8 overflow-hidden rounded-4xl border-2 border-ink bg-ink px-6 py-8 text-cream shadow-soft md:px-10 md:py-10">
        <div className="absolute -right-10 -top-16 size-56 rounded-full border-[28px] border-mint/20" /><div className="absolute bottom-5 right-16 hidden text-7xl text-sun/80 md:block">♪</div>
        <div className="relative max-w-2xl"><div className="mb-5 inline-flex items-center gap-2 rounded-full bg-cream/10 px-3 py-1 text-xs font-bold"><span className="size-2 animate-pulse rounded-full bg-mint" /> Your groove is building</div>
          <h2 className="font-[var(--font-display)] text-3xl font-black leading-tight md:text-5xl">Your experience has a rhythm.<br/><span className="text-sun">Let’s make it heard.</span></h2>
          <p className="mt-4 max-w-lg text-sm leading-6 text-cream/70 md:text-base">Capture the work, people, places, and wins that shaped you—then turn them into your next move.</p>
          <button onClick={()=>router.push("/interview")} className="mt-6 flex items-center gap-2 font-black text-mint">Continue your story <ArrowUpRight size={18}/></button>
        </div>
      </motion.section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-3xl border-2 border-ink bg-white p-5 shadow-[0_5px_0_#26312c]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.2em] text-plum">Command Session</p>
              <h2 className="mt-1 font-[var(--font-display)] text-2xl font-black">{session?.title || "Today's Mix"}</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-ink/60">{session?.actions?.length ? "Pick one clear next move and let the tracker carry the rest of the context." : "Build a fresh setlist from your applications, follow-ups, and anything already in motion."}</p>
            </div>
            <MotionButton onClick={()=>router.push("/applications")} className="rounded-2xl border-2 border-ink bg-sun px-4 py-3 text-sm font-black shadow-pop">Open Tracker</MotionButton>
          </div>
          <div className="mt-4 space-y-3">
            {session?.actions?.length ? session.actions.slice(0, 3).map((action, index) => <button key={action.id} onClick={()=>router.push(action.routeTarget)} className="flex w-full items-start gap-3 rounded-2xl bg-cream p-4 text-left">
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-plum text-xs font-black text-white">{index + 1}</div>
              <div>
                <p className="font-black">{action.title}</p>
                <p className="mt-1 text-sm leading-5 text-ink/60">{action.reason}</p>
              </div>
            </button>) : <div className="rounded-2xl bg-cream p-4 text-sm font-bold text-ink/55">No active setlist yet. Start one from Applications when you want CareerGroove to pick the beat.</div>}
          </div>
        </div>
        <div className="rounded-3xl border-2 border-ink/15 bg-white/65 p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.2em] text-plum">Hot opportunities</p>
              <h2 className="font-[var(--font-display)] text-2xl font-black">What deserves attention?</h2>
            </div>
            <button onClick={()=>router.push("/applications")} className="text-sm font-bold underline decoration-coral decoration-2 underline-offset-4">See all</button>
          </div>
          <div className="mt-4 space-y-3">
            {applications.length ? applications.map((application) => <button key={application.id} onClick={()=>router.push(`/applications?applicationId=${application.id}`)} className="w-full rounded-2xl bg-cream px-4 py-3 text-left">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-black">{application.title}</p>
                  <p className="truncate text-sm text-ink/55">{application.company}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[.16em]">{application.priorityLabel ? application.priorityLabel.replaceAll("_", " ") : application.status}</span>
              </div>
              {application.followUpDueAt && <p className="mt-2 text-xs font-bold text-coral">Follow-up due {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(application.followUpDueAt))}</p>}
            </button>) : <div className="rounded-2xl bg-cream p-4 text-sm font-bold text-ink/55">Save one role and CareerGroove will start surfacing the best leads here.</div>}
          </div>
        </div>
      </section>

      <section className="mt-9"><div className="flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-[.2em] text-plum">Pick up the beat</p><h2 className="font-[var(--font-display)] text-2xl font-black">What are we working on?</h2></div><button className="hidden text-sm font-bold underline decoration-coral decoration-2 underline-offset-4 sm:block">See all tools</button></div>
        <div className="mt-5 grid gap-4 lg:grid-cols-5">{tools.map(({ icon: Icon, title, copy, color, tag, href }, i) => <motion.button onClick={() => href && router.push(href)} key={title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .1 + i * .08 }} whileHover={{ y: -5, rotate: i - 1 }} whileTap={{ scale: .98 }} className="group rounded-3xl border-2 border-ink bg-white p-5 text-left shadow-[0_5px_0_#26312c]">
          <div className={`grid size-12 place-items-center rounded-2xl border-2 border-ink ${color}`}><Icon size={23}/></div><p className="mt-5 text-[10px] font-black uppercase tracking-[.18em] text-plum">{tag}</p><h3 className="mt-1 font-[var(--font-display)] text-xl font-black">{title}</h3><p className="mt-2 text-sm leading-5 text-ink/60">{copy}</p><span className="mt-5 flex items-center gap-1 text-sm font-black group-hover:text-coral">Start a session <ArrowUpRight size={16}/></span>
        </motion.button>)}</div>
      </section>

      <section className="mt-10 grid gap-5 lg:grid-cols-[1.4fr_.6fr]"><div className="rounded-3xl border-2 border-ink/15 bg-white/60 p-5"><div className="flex justify-between"><div><p className="text-xs font-black uppercase tracking-[.2em] text-plum">Your timeline</p><h2 className="font-[var(--font-display)] text-xl font-black">Recent chapters</h2></div><button onClick={()=>router.push("/journey")}><ArrowUpRight /></button></div>{recentJobs.length?recentJobs.map(job=><div key={job.id} className="mt-5 flex gap-4"><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-plum text-white"><BriefcaseBusiness size={20}/></div><div><p className="font-black">{job.title}</p><p className="text-sm text-ink/55">{job.company}</p></div></div>):<div className="mt-5 flex gap-4"><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-plum text-white"><BriefcaseBusiness size={20}/></div><div><p className="font-black">Add your current role</p><p className="text-sm text-ink/55">A title and company is enough to get started.</p></div></div>}</div>
        <div className="space-y-4">
          <button onClick={()=>router.push("/follow-ups")} className="w-full rounded-3xl border-2 border-ink bg-white p-5 text-left shadow-[0_5px_0_#26312c]">
            <div className="flex items-center justify-between">
              <Mail size={24} className="text-coral" />
              {overdueCount > 0 && <span className="rounded-full bg-coral px-3 py-1 text-xs font-black text-white">{overdueCount} overdue</span>}
            </div>
            <p className="mt-4 font-[var(--font-display)] text-xl font-black">Follow-ups</p>
            <p className="mt-1 text-sm text-ink/60">Stay on top of every outreach. Schedule, draft, and track conversations.</p>
          </button>
          <button onClick={()=>router.push("/brand")} className="w-full rounded-3xl border-2 border-ink/15 bg-white/60 p-5 text-left">
            <Palette size={24} className="text-plum" />
            <p className="mt-4 font-[var(--font-display)] text-xl font-black">Brand Studio</p>
            <p className="mt-1 text-sm text-ink/60">Polish your LinkedIn, GitHub, and personal brand with AI.</p>
          </button>
        </div></section>
    </main>
    <MusicPlayer />
    <nav className="fixed inset-x-3 bottom-3 z-30 flex justify-start gap-1 overflow-x-auto rounded-3xl border-2 border-ink bg-ink px-2 py-2 text-cream shadow-soft md:hidden">{nav.map(({ icon: Icon, name, href }, i) => <button onClick={()=>router.push(href)} key={name} className={`flex min-w-16 flex-col items-center gap-1 rounded-2xl py-2 text-[10px] font-bold ${i === 0 ? "bg-cream text-ink" : "text-cream/60"}`}><Icon size={19}/>{name}</button>)}<AccountMenu mobile/></nav>
  </div>;
}
