"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Reveal } from "./reveal";

type Plan = "monthly" | "yearly" | "lifetime";
interface PlanDetails { id: Plan; name: string; price: string; cadence: string; note: string; featured?: boolean; features: string[] }
interface PricingProps { signedIn: boolean }

const common = ["Unlimited career CRM", "30 AI document generations / month", "Unlimited interview prep", "All future core features"];

export function Pricing({ signedIn }: PricingProps) {
  const [yearly, setYearly] = useState(true);
  const [loading, setLoading] = useState<Plan | null>(null);
  const [error, setError] = useState("");
  const recurring: PlanDetails = yearly
    ? { id: "yearly", name: "Pro Yearly", price: "$99", cadence: "/ year", note: "Save $81 every year", featured: true, features: common }
    : { id: "monthly", name: "Pro Monthly", price: "$15", cadence: "/ month", note: "Simple, flexible billing", featured: true, features: common };
  const lifetime: PlanDetails = { id: "lifetime", name: "Lifetime Early Bird", price: "$199", cadence: " once", note: "Limited early-bird offer", features: ["Unlimited career CRM forever", "30 AI document generations / month", "Unlimited interview prep", "No recurring subscription"] };

  async function checkout(plan: Plan) {
    setLoading(plan); setError("");
    try {
      if (!signedIn) { window.location.assign(`/register?plan=${plan}`); return; }
      const response = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
      const data = await response.json() as { url?: string; redirectUrl?: string; error?: string };
      if (data.redirectUrl) { window.location.assign(data.redirectUrl); return; }
      if (!response.ok || !data.url) throw new Error(data.error || "Checkout could not be started.");
      window.location.assign(data.url);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Checkout could not be started."); setLoading(null); }
  }

  return <section id="pricing" className="bg-fog/60 px-5 py-20 lg:px-8 lg:py-28"><div className="mx-auto max-w-5xl"><Reveal className="text-center"><p className="text-xs font-black uppercase tracking-[.22em] text-plum">A small investment in every next move</p><h2 className="mt-3 font-[var(--font-display)] text-4xl font-black sm:text-5xl">Choose your groove.</h2><p className="mx-auto mt-4 max-w-xl text-ink/60">All the tools you need to capture your story, shape your application, and show up ready.</p><div className="mx-auto mt-7 inline-flex rounded-2xl border-2 border-ink bg-white p-1" role="group" aria-label="Billing cadence"><button onClick={() => setYearly(false)} className={`rounded-xl px-5 py-2.5 text-sm font-black transition ${!yearly ? "bg-ink text-cream" : "text-ink/55"}`}>Monthly</button><button onClick={() => setYearly(true)} className={`rounded-xl px-5 py-2.5 text-sm font-black transition ${yearly ? "bg-ink text-cream" : "text-ink/55"}`}>Yearly <span className="text-mint">save 45%</span></button></div></Reveal>
    {error && <p role="alert" className="mx-auto mt-6 max-w-xl rounded-2xl border-2 border-coral bg-coral/10 px-4 py-3 text-center text-sm font-bold">{error}</p>}
    <div className="mt-10 grid items-stretch gap-6 md:grid-cols-2"><AnimatePresence mode="wait"><motion.div key={recurring.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: .2 }}><PricingCard plan={recurring} loading={loading === recurring.id} onChoose={checkout}/></motion.div></AnimatePresence><PricingCard plan={lifetime} loading={loading === "lifetime"} onChoose={checkout}/></div>
    <p className="mt-7 text-center text-xs text-ink/45">Secure payment powered by Stripe. Recurring plans renew automatically until canceled.</p></div></section>;
}

interface PricingCardProps { plan: PlanDetails; loading: boolean; onChoose: (plan: Plan) => void }
function PricingCard({ plan, loading, onChoose }: PricingCardProps) {
  return <article className={`relative flex h-full flex-col rounded-4xl border-2 border-ink p-7 sm:p-8 ${plan.featured ? "bg-ink text-cream shadow-[8px_9px_0_#ff6b57]" : "bg-white shadow-[8px_9px_0_#26312c]"}`}>{plan.featured && <span className="absolute -top-4 right-6 rotate-2 rounded-full border-2 border-ink bg-sun px-4 py-1.5 text-xs font-black uppercase tracking-[.12em] text-ink">Best value</span>}<p className={`text-xs font-black uppercase tracking-[.18em] ${plan.featured ? "text-mint" : "text-plum"}`}>{plan.name}</p><div className="mt-4 flex items-end gap-1"><span className="font-[var(--font-display)] text-5xl font-black">{plan.price}</span><span className={`pb-1 text-sm ${plan.featured ? "text-cream/60" : "text-ink/55"}`}>{plan.cadence}</span></div><p className={`mt-2 text-sm font-bold ${plan.featured ? "text-sun" : "text-coral"}`}>{plan.note}</p><ul className="mt-7 flex-1 space-y-3">{plan.features.map(feature => <li key={feature} className="flex gap-3 text-sm"><span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${plan.featured ? "bg-mint text-ink" : "bg-mint/25"}`}><Check size={13} strokeWidth={4}/></span>{feature}</li>)}</ul><button disabled={loading} onClick={() => onChoose(plan.id)} className={`mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border-2 px-5 py-4 font-black transition active:translate-y-1 disabled:opacity-60 ${plan.featured ? "border-cream bg-coral text-ink shadow-[0_5px_0_#f6f0e5] active:shadow-none" : "border-ink bg-sun shadow-pop active:shadow-none"}`}>{loading ? <><LoaderCircle className="animate-spin" size={19}/>Opening checkout…</> : <>Choose {plan.name}<ArrowRight size={18}/></>}</button></article>;
}
