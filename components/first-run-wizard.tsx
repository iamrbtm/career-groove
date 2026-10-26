"use client";
import { motion } from "framer-motion";
import { ArrowUpRight, BriefcaseBusiness, Check, ClipboardList, FileText, RefreshCw, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, getApiError } from "@/lib/ui/api-fetch";
import { useToast } from "@/lib/ui/toast";
import { AppShell, PageHeading } from "./app-shell";
import { MotionButton } from "./motion-button";

export type FirstRunSteps = {
  profile: boolean;
  careerChapters: boolean;
  firstApplication: boolean;
  firstResume: boolean;
};

const stepMeta = [
  { key: "profile", icon: UserRound, color: "bg-mint", title: "Set your contact details", copy: "Drop in a phone number so a recruiter can reach you on the first ring.", href: "/profile", label: "Open profile" },
  { key: "careerChapters", icon: BriefcaseBusiness, color: "bg-coral", title: "Record a career chapter", copy: "A job, a gig, a wild season—one title and company is enough for the first verse.", href: "/journey", label: "Add a chapter" },
  { key: "firstApplication", icon: ClipboardList, color: "bg-sun", title: "Capture your first role", copy: "Paste a posting or hunt down a fresh lead. Your tracker keeps the whole search in rhythm.", href: "/applications?capture=1", label: "Open tracker" },
  { key: "firstResume", icon: FileText, color: "bg-fog", title: "Generate your first resume", copy: "Turn the chapters you've played into a tailored resume in a few beats.", href: "/documents", label: "Open documents" },
] as const;

export function FirstRunWizard({ name, steps: initialSteps }: { name?: string; steps: FirstRunSteps }) {
  const router = useRouter();
  const { push } = useToast();
  const [steps, setSteps] = useState<FirstRunSteps>(initialSteps);
  const [refreshing, setRefreshing] = useState(false);
  const doneCount = stepMeta.filter(({ key }) => steps[key]).length;
  const firstName = name?.trim().split(" ")[0];

  async function refresh() {
    setRefreshing(true);
    try {
      const response = await apiFetch("/api/user/onboarding", { cache: "no-store" });
      const data = (await response.json()) as { complete: boolean; steps: FirstRunSteps };
      setSteps(data.steps);
      if (data.complete) {
        push("All four notes hit—that's the full groove!");
        router.replace("/dashboard");
      } else {
        push("Progress refreshed. Keep the beat!");
      }
    } catch (error) {
      push(getApiError(error), "error");
    } finally {
      setRefreshing(false);
    }
  }

  return <AppShell>
    <PageHeading
      eyebrow="First-run warm-up"
      title={firstName ? `Let's find your groove, ${firstName}.` : "Let's find your groove."}
      copy="Four small moves and your space is ready to play. Leave any time—your progress keeps itself."
      action={<MotionButton onClick={refresh} disabled={refreshing} className="flex h-fit items-center gap-2 rounded-2xl border-2 border-fg bg-sun px-4 py-3 text-sm font-black shadow-pop disabled:opacity-60"><RefreshCw size={18} className={refreshing ? "animate-spin" : ""} /> Refresh progress</MotionButton>}
    />
    <div className="mt-7 flex items-center gap-3">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full border-2 border-edge/15 bg-panel"><motion.div className="h-full rounded-full bg-coral" initial={{ width: 0 }} animate={{ width: `${(doneCount / stepMeta.length) * 100}%` }} transition={{ type: "spring", stiffness: 300, damping: 26 }} /></div>
      <p className="text-xs font-black uppercase tracking-[.18em] text-plum">{doneCount} of {stepMeta.length} notes</p>
    </div>
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      {stepMeta.map(({ key, icon: Icon, color, title, copy, href, label }, i) => {
        const done = steps[key];
        return <motion.div key={key} initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .08 + i * .07, type: "spring", stiffness: 320, damping: 24 }} className="rounded-4xl border-2 border-ink bg-panel p-6 shadow-soft">
          <div className="flex items-start justify-between gap-4">
            <div className={`grid size-12 place-items-center rounded-2xl border-2 border-fg ${color}`}><Icon size={23} /></div>
            {done && <span className="flex items-center gap-1.5 rounded-full bg-mint px-3 py-1 text-xs font-black"><Check size={14} /> Done</span>}
          </div>
          <p className="mt-5 text-[10px] font-black uppercase tracking-[.18em] text-plum">Step {i + 1}</p>
          <h2 className="mt-1 font-[var(--font-display)] text-xl font-black">{title}</h2>
          <p className="mt-2 text-sm leading-5 text-fg/60">{copy}</p>
          <button onClick={() => router.push(href)} disabled={done} className="mt-5 flex items-center gap-2 rounded-2xl border-2 border-fg bg-coral px-4 py-2.5 text-sm font-black shadow-[0_4px_0_#26312c] active:translate-y-0.5 disabled:bg-panel disabled:text-fg/40 disabled:shadow-none">{done ? "Checked off" : label} <ArrowUpRight size={16} /></button>
        </motion.div>;
      })}
    </div>
    <div className="mt-8 text-center">
      <Link href="/dashboard" className="text-sm font-black underline decoration-coral decoration-2 underline-offset-4">Skip for now</Link>
    </div>
  </AppShell>;
}
