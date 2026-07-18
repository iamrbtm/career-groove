import Link from "next/link";
import { KeyRound } from "lucide-react";
import { signIn } from "@/auth";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const requestedUrl = (await searchParams).callbackUrl;
  const callbackUrl = requestedUrl?.startsWith("/") && !requestedUrl.startsWith("//") ? requestedUrl : "/dashboard";
  const social = [
    process.env.AUTH_GOOGLE_ID && { id: "google", label: "Continue with Google" },
    process.env.AUTH_GITHUB_ID && { id: "github", label: "Continue with GitHub" },
    process.env.AUTH_APPLE_ID && { id: "apple", label: "Continue with Apple" },
    process.env.AUTH_EXPERIMENTAL_ENABLE_PASSKEYS === "true" && { id: "passkey", label: "Continue with a passkey" },
  ].filter(Boolean) as Array<{id:string;label:string}>;
  return <main className="grid min-h-dvh place-items-center p-6"><div className="w-full max-w-md rounded-4xl border-2 border-ink bg-white p-8 shadow-pop"><p className="text-xs font-black uppercase tracking-[.2em] text-plum">Welcome back</p><h1 className="mt-2 font-[var(--font-display)] text-3xl font-black">Find your groove.</h1>{social.length>0&&<div className="mt-6 space-y-2">{social.map(provider=><form key={provider.id} action={async()=>{"use server";await signIn(provider.id,{redirectTo:callbackUrl})}}><button className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-ink/20 py-3 text-sm font-black hover:border-ink"><KeyRound size={17}/>{provider.label}</button></form>)}<div className="flex items-center gap-3 py-2 text-xs font-bold text-ink/35"><span className="h-px flex-1 bg-ink/15"/>or use email<span className="h-px flex-1 bg-ink/15"/></div></div>}<form action={async (formData) => { "use server"; await signIn("credentials", { ...Object.fromEntries(formData), redirectTo: callbackUrl }); }} className={`${social.length?"":"mt-7"} space-y-4`}><label className="block text-sm font-bold">Email<input name="email" type="email" required className="mt-1 w-full rounded-2xl border-2 border-ink/20 px-4 py-3 outline-none focus:border-coral"/></label><label className="block text-sm font-bold">Password<input name="password" type="password" minLength={8} required className="mt-1 w-full rounded-2xl border-2 border-ink/20 px-4 py-3 outline-none focus:border-coral"/></label><button className="w-full rounded-2xl border-2 border-ink bg-coral py-3 font-black shadow-pop">Step inside</button></form><p className="mt-6 text-center text-sm text-ink/55">New here? <Link href={callbackUrl.startsWith("/api/stripe/checkout") ? `/register?${callbackUrl.split("?")[1]}` : "/register"} className="font-black text-ink underline">Create an account</Link></p></div></main>;
}
