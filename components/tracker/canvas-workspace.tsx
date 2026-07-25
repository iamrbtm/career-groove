"use client";

import { Sparkles } from "lucide-react";

export function CanvasWorkspace({ children }: { children: React.ReactNode }) {
  return <div className="space-y-5">{children}</div>;
}

export function CanvasEmptyState() {
  return (
    <section className="rounded-3xl border-2 border-dashed border-ink/20 bg-white/50 p-8">
      <Sparkles className="text-coral" />
      <h2 className="mt-4 font-[var(--font-display)] text-2xl font-black">Start with one role.</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-ink/60">
        CareerGroove will keep the next step visible here: apply, research, remix documents, follow up, prep, or log an outcome.
      </p>
    </section>
  );
}
