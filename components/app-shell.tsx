"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, BriefcaseBusiness, ClipboardList, FileText, Home, Mail, MessageCircleMore, MoreHorizontal, Network, Palette, Send, Settings2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
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

const primaryHrefs = ["/dashboard", "/applications", "/documents", "/follow-ups"];

type NavItem = (typeof allItems)[number];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { tier } = useTier();
  const [moreOpen, setMoreOpen] = useState(false);

  const items = tier === "pro" ? allItems.concat(proItems) : allItems;

  const primary = items
    .reduce((acc, item) => {
      const slot = primaryHrefs.indexOf(item.href);
      if (slot !== -1) acc[slot] = item;
      return acc;
    }, [] as (NavItem | undefined)[])
    .filter((item): item is NavItem => Boolean(item));
  const overflow = items.filter((item) => !primaryHrefs.includes(item.href));

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMoreOpen(false);
    }
    if (!moreOpen) return;
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  return <div className="min-h-dvh pb-28 md:pb-8">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-24 flex-col items-center border-r-2 border-ink/10 bg-ink py-7 text-cream md:flex">
      <Link href="/dashboard" className="grid size-12 place-items-center rounded-2xl bg-coral text-xl font-black shadow-[0_4px_0_#ffc857]">CG</Link>
      <nav className="mt-12 flex flex-1 flex-col gap-5">
        {items.map(({ href, name, icon: Icon }) => {
          const active = path === href;
          return <Link key={href} href={href} title={name} aria-label={name} aria-current={active ? "page" : undefined} className="relative grid size-12 place-items-center rounded-2xl">
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
      {primary.map(({ href, name, icon: Icon }) => {
        const active = path === href;
        return <Link key={href} href={href} aria-label={name} aria-current={active ? "page" : undefined} className="relative flex min-w-16 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-bold">
          {active && <motion.div layoutId="mobile-nav-active" className="absolute inset-0 rounded-2xl bg-cream" transition={{ type: "spring", stiffness: 500, damping: 32 }} />}
          <motion.span whileTap={{ scale: 0.85 }} className={`relative z-10 flex flex-col items-center gap-1 ${active ? "text-ink" : "text-cream/60"}`}>
            <Icon size={18} />{name}
          </motion.span>
        </Link>;
      })}
      <motion.button whileTap={{ scale: 0.85 }} onClick={() => setMoreOpen(true)} aria-label="More destinations" aria-expanded={moreOpen} className="relative flex min-w-16 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-bold text-cream/60">
        <MoreHorizontal size={18} />More
      </motion.button>
      <ThemeToggle mobile />
      <AccountMenu mobile />
    </nav>
    <AnimatePresence>
      {moreOpen && <div key="more-sheet" className="fixed inset-0 z-40 md:hidden">
        <motion.button type="button" aria-label="Close menu" onClick={() => setMoreOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 w-full bg-ink/60" />
        <motion.div role="dialog" aria-modal="true" aria-label="More destinations" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 380, damping: 40 }} className="absolute inset-x-3 bottom-3 max-h-[70dvh] overflow-y-auto rounded-3xl border-2 border-fg bg-panel p-3 text-fg shadow-[6px_7px_0_#26312c]">
          <p className="px-3 pb-2 pt-1 text-[10px] font-black uppercase tracking-[.18em] text-plum">More destinations</p>
          {overflow.map(({ href, name, icon: Icon }) => {
            const active = path === href;
            return <Link key={href} href={href} onClick={() => setMoreOpen(false)} aria-label={name} aria-current={active ? "page" : undefined} className={`relative flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold ${active ? "bg-paper text-fg" : "text-fg/70 hover:bg-edge/40"}`}>
              {active && <motion.span layoutId="sheet-nav-active" className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-full bg-coral" transition={{ type: "spring", stiffness: 500, damping: 32 }} />}
              <Icon size={18} className="relative z-10" />{name}
            </Link>;
          })}
        </motion.div>
      </div>}
    </AnimatePresence>
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
