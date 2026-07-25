import Link from "next/link";

export function LandingFooter() {
  return <footer className="border-t-2 border-ink bg-ink px-5 py-12 text-cream lg:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between"><div><Link href="/" className="font-[var(--font-display)] text-xl font-black">CareerGroove <span className="text-coral">♪</span></Link><p className="mt-2 text-sm text-cream/55">Your career, in rhythm.</p></div><nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold text-cream/65"><Link href="/signin">Log in</Link><Link href="#features">Features</Link><Link href="#pricing">Pricing</Link><Link href="mailto:hello@careergroove.app">Contact</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav></div><div className="mx-auto mt-10 max-w-7xl border-t border-cream/15 pt-6 text-xs text-cream/40">© {new Date().getFullYear()} CareerGroove. Built for the stories behind the résumé.</div></footer>;
}
