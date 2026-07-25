"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

interface RegisterFormProps { plan?: "monthly" | "yearly" | "lifetime" }

export function RegisterForm({ plan }: RegisterFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
    if (response.ok) {
      const result = await signIn("credentials", {
        email: String(form.get("email")), password: String(form.get("password")), redirect: false,
      });
      if (result?.error) { router.push(`/signin?created=1${plan ? `&callbackUrl=${encodeURIComponent(`/api/stripe/checkout?plan=${plan}`)}` : ""}`); return; }
      window.location.assign(plan ? `/api/stripe/checkout?plan=${plan}` : "/dashboard");
    }
    else { const body = await response.json(); setError(typeof body.error === "string" ? body.error : "Check your details and try again."); setLoading(false); }
  }
  return <div className="w-full max-w-md rounded-4xl border-2 border-ink bg-white p-8 shadow-pop"><p className="text-xs font-black uppercase tracking-[.2em] text-plum">First verse</p><h1 className="mt-2 font-[var(--font-display)] text-3xl font-black">Start your story.</h1><p className="mt-2 text-sm text-ink/55">A private home for the work and life that shaped you.</p><form onSubmit={submit} className="mt-7 space-y-4"><label className="block text-sm font-bold">Name<input name="name" required minLength={2} className="mt-1 w-full rounded-2xl border-2 border-ink/20 px-4 py-3 outline-none focus:border-coral"/></label><label className="block text-sm font-bold">Email<input name="email" type="email" required className="mt-1 w-full rounded-2xl border-2 border-ink/20 px-4 py-3 outline-none focus:border-coral"/></label><label className="block text-sm font-bold">Password<input name="password" type="password" minLength={10} required className="mt-1 w-full rounded-2xl border-2 border-ink/20 px-4 py-3 outline-none focus:border-coral"/><span className="mt-1 block text-xs font-normal text-ink/45">10+ characters with a letter and number</span></label>{error && <p role="alert" className="rounded-xl bg-coral/15 px-3 py-2 text-sm font-bold">{error}</p>}<button disabled={loading} className="w-full rounded-2xl border-2 border-ink bg-coral py-3 font-black shadow-pop disabled:opacity-60">{loading ? "Creating…" : "Create my space"}</button></form><p className="mt-6 text-center text-sm text-ink/55">Already have an account? <Link href="/signin" className="font-black text-ink underline">Sign in</Link></p></div>;
}
