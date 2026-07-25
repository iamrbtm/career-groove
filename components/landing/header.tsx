"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface LandingHeaderProps { signedIn: boolean }

export function LandingHeader({ signedIn }: LandingHeaderProps) {
  const [open, setOpen] = useState(false);
  const links = [{ label: "Why CareerGroove", href: "#features" }, { label: "Pricing", href: "#pricing" }, { label: "How it works", href: "#how-it-works" }];
  return (
    <header className="sticky top-0 z-50 border-b-2 border-ink/10 bg-cream/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
        <Link href="/" className="flex items-center gap-3 font-[var(--font-display)] text-lg font-black">
          <span className="grid size-10 place-items-center rounded-2xl border-2 border-ink bg-coral shadow-[0_3px_0_#26312c]">CG</span>
          CareerGroove
        </Link>
        <nav className="hidden items-center gap-8 md:flex" aria-label="Main navigation">
          {links.map((link) => <Link key={link.href} href={link.href} className="text-sm font-bold text-ink/65 transition hover:text-ink">{link.label}</Link>)}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <Link href={signedIn ? "/dashboard" : "/signin?callbackUrl=/dashboard"} className="rounded-2xl px-4 py-2.5 text-sm font-black hover:bg-white/70">{signedIn ? "Dashboard" : "Log in"}</Link>
          <Link href="#pricing" className="rounded-2xl border-2 border-ink bg-coral px-4 py-2.5 text-sm font-black shadow-[0_4px_0_#26312c] transition active:translate-y-1 active:shadow-none">Get started</Link>
        </div>
        <button onClick={() => setOpen(!open)} className="grid size-11 place-items-center rounded-2xl border-2 border-ink md:hidden" aria-expanded={open} aria-label="Toggle navigation">{open ? <X /> : <Menu />}</button>
      </div>
      {open && <nav className="border-t-2 border-ink/10 bg-cream px-5 py-5 md:hidden" aria-label="Mobile navigation"><div className="mx-auto flex max-w-7xl flex-col gap-2">{links.map((link) => <Link onClick={() => setOpen(false)} key={link.href} href={link.href} className="rounded-xl px-3 py-3 font-bold hover:bg-white">{link.label}</Link>)}<Link href={signedIn ? "/dashboard" : "/signin?callbackUrl=/dashboard"} className="mt-2 rounded-2xl border-2 border-ink bg-coral px-4 py-3 text-center font-black">{signedIn ? "Open dashboard" : "Log in"}</Link></div></nav>}
    </header>
  );
}
