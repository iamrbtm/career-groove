"use client";

import { ArrowRight, CalendarDays, CheckCircle2, CreditCard, LoaderCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AppShell, PageHeading } from "./app-shell";

interface BillingDetails { status: string | null; priceId: string | null; periodEnd: string | Date | null; hasCustomer: boolean }

function labelForStatus(status: string | null) {
  if (!status) return "No active plan";
  if (status === "lifetime") return "Lifetime access";
  return status.replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase());
}

export function BillingPanel({ billing }: { billing: BillingDetails }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const active = billing.status === "active" || billing.status === "trialing" || billing.status === "lifetime";
  async function openPortal() {
    setLoading(true); setError("");
    const response = await fetch("/api/stripe/portal", { method: "POST" });
    const body = await response.json().catch(() => null);
    if (response.ok && body?.url) window.location.assign(body.url);
    else { setError(body?.error || "The billing portal could not be opened."); setLoading(false); }
  }
  return <AppShell><PageHeading eyebrow="Your account" title="Billing" copy="Review your CareerGroove access and manage payments securely through Stripe."/><div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_340px]"><section className="rounded-4xl border-2 border-ink bg-ink p-6 text-cream shadow-[0_7px_0_#ff6b57] sm:p-8"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div><p className="text-xs font-black uppercase tracking-[.18em] text-mint">Current plan</p><h2 className="mt-2 font-[var(--font-display)] text-3xl font-black">{labelForStatus(billing.status)}</h2></div><span className={`inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-wider ${active ? "bg-mint text-ink" : "bg-cream/10 text-cream/60"}`}>{active ? <CheckCircle2 size={16}/> : <CreditCard size={16}/>} {active ? "Access active" : "Not subscribed"}</span></div>{billing.periodEnd && <div className="mt-8 flex items-center gap-3 rounded-2xl bg-cream/10 p-4"><CalendarDays className="text-sun"/><div><p className="text-xs font-bold text-cream/50">Current period ends</p><p className="font-black">{new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(billing.periodEnd))}</p></div></div>}{error && <p role="alert" className="mt-5 rounded-2xl bg-coral/20 px-4 py-3 text-sm font-bold">{error}</p>}<div className="mt-8 flex flex-col gap-3 sm:flex-row">{billing.hasCustomer && <button disabled={loading} onClick={openPortal} className="flex items-center justify-center gap-2 rounded-2xl border-2 border-cream bg-coral px-5 py-3 font-black text-ink transition active:translate-y-1 disabled:opacity-60">{loading ? <LoaderCircle className="animate-spin" size={18}/> : <CreditCard size={18}/>} {loading ? "Opening…" : "Manage billing"}</button>}<Link href="/#pricing" className="flex items-center justify-center gap-2 rounded-2xl border-2 border-cream/25 px-5 py-3 font-black hover:border-cream">{active ? "View plans" : "Choose a plan"}<ArrowRight size={18}/></Link></div></section><aside className="rounded-4xl border-2 border-ink bg-sun/35 p-6"><Sparkles size={28}/><h2 className="mt-5 font-[var(--font-display)] text-xl font-black">Stripe-secured</h2><p className="mt-2 text-sm leading-6 text-ink/60">Payment methods, invoices, and subscription changes are handled in Stripe’s secure customer portal.</p>{billing.status === "lifetime" && <p className="mt-4 rounded-2xl bg-white/60 p-3 text-xs font-bold">Your lifetime plan has no recurring renewal date.</p>}</aside></div></AppShell>;
}
