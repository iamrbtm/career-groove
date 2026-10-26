"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { BarChart3, BriefcaseBusiness, ClipboardList, FileText, Home, Mail, MessageCircleMore, Network, Palette, Send, Settings2, Sparkles } from "lucide-react";
import { MusicPlayer } from "./music-player";
import { AccountMenu } from "./account-menu";
import { ResearchChat } from "./research-chat";
import { ThemeToggle } from "./theme-toggle";
import { useTier } from "@/lib/hooks/use-tier";

const proItems = [
  { href: "/interview", name: "Interview", icon: MessageCircleMore },
  { href: "/mock-interview", name: "Prep", icon: Sparkles },
];

const allItems = [
  { href: "/dashboard", name: "Home", icon: Home },
  { href: "/journey", name: "Journey", icon: BriefcaseBusiness },
  { href: "/applications", name: "Applications", icon: ClipboardList },
  { href: "/follow-ups", name: "Follow-ups", icon: Mail },
  { href: "/email-log", name: "Sent mail", icon: Send },
  { href: "/analytics", name: "Analytics", icon: BarChart3 },
  { href: "/network", name: "Network", icon: Network },
  { href: "/documents", name: "Documents", icon: FileText },
  { href: "/brand", name: "Brand", icon: Palette },
  { href: "/settings", name: "Settings", icon: Settings2 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { tier } = useTier();

  const items = tier === "pro" ? allItems.concat(proItems) : allItems;

  return <div className="min-h-dvh pb-28 md:pb-8">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-24 flex-col items-center border-r-2 border-ink/10 bg-ink py-7 text-cream md:flex">
      <Link href="/dashboard" className="grid size-12 place-items-center rounded-2xl bg-coral text-xl font-black shadow-[0_4px_0_#ffc857]">CG</Link>
      <nav className="mt-12 flex flex-1 flex-col gap-5">
        {items.map(({ href, name, icon: Icon }) => {
          const active = path === href;
          return <Link key={href} href={href} title={name} className="relative grid size-12 place-items-center rounded-2xl">
            {active && <motion.div layoutId="desktop-nav-active" className="absolute inset-0 rounded-2xl bg-cream" transition={{ type: "spring", stiffness: 500, damping: 32 }} />}
            <motion.span whileTap={{ scale: 0.82 }} className={`relative z-10 grid place-items-center ${active ? "text-ink" : "text-cream/60 hover:text-cream"}`}>
              <Icon size={21} />
            </motion.span>
          </Link>;
        })}
      </nav>
      <ThemeToggle />
      <AccountMenu />
    </aside>
    <main className="mx-auto max-w-7xl px-5 pt-6 md:pl-32 md:pr-10 md:pt-10">
      <motion.div key={path} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .28, ease: "easeOut" }}>
        {children}
      </motion.div>
    </main>
      <MusicPlayer />
      <ResearchChat />
    <nav className="fixed inset-x-3 bottom-3 z-30 flex justify-start gap-1 overflow-x-auto rounded-3xl border-2 border-ink bg-ink px-2 py-2 text-cream shadow-soft md:hidden">
      {items.map(({ href, name, icon: Icon }) => {
        const active = path === href;
        return <Link key={href} href={href} className="relative flex min-w-16 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-bold">
          {active && <motion.div layoutId="mobile-nav-active" className="absolute inset-0 rounded-2xl bg-cream" transition={{ type: "spring", stiffness: 500, damping: 32 }} />}
          <motion.span whileTap={{ scale: 0.85 }} className={`relative z-10 flex flex-col items-center gap-1 ${active ? "text-ink" : "text-cream/60"}`}>
            <Icon size={18} />{name}
          </motion.span>
        </Link>;
      })}
      <ThemeToggle mobile />
      <AccountMenu mobile />
    </nav>
  </div>;
}

export function PageHeading({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: React.ReactNode }) {
  return <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
    <div>
      <p className="text-xs font-black uppercase tracking-[.22em] text-plum">{eyebrow}</p>
      <h1 className="mt-1 font-[var(--font-display)] text-3xl font-black md:text-4xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm text-fg/55">{copy}</p>
    </div>
    {action}
  </header>;
}
