"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, FileText, Radio, Sparkles, TrendingUp } from "lucide-react";
import { AppShell, PageHeading } from "./app-shell";

type Analytics = {
  summary: {
    total: number;
    savedThisWeek: number;
    submittedCount: number;
    followUpsDue: number;
    followUpsScheduled?: number;
    interviewsActive: number;
    offersActive: number;
    rejectionsLogged: number;
    responseRate: number;
    interviewRate: number;
    followUpHealth?: number;
  };
  sources: Array<{ source: string; count: number }>;
  sourceHealth?: Array<{ source: string; total: number; responses: number; offers: number; responseRate: number }>;
  labels: Array<{ label: string; count: number }>;
  outcomes?: Array<{ outcome: string; count: number }>;
  resumePerformance?: Array<{ version: string; outcomes: number; positive: number; closed: number; positiveRate: number }>;
  roleFitTrends?: Array<{ roleFit: string; similarStrategy: string; count: number }>;
};

type InsightResponse = {
  lowData: boolean;
  closedCount: number;
  insights: Array<{
    id: string;
    kind: string;
    title: string;
    copy: string;
    evidence: string[];
    suggestion: string;
    confidence: "low" | "medium" | "high";
    state: "active" | "dismissed" | "later";
  }>;
};

const labelText: Record<string, string> = {
  apply_first: "Apply First",
  research_before_applying: "Research Before Applying",
  remix_resume_first: "Remix Resume First",
  network_first: "Network First",
  stretch_role: "Stretch Role",
  low_signal_lead: "Low-Signal Lead",
  probably_skip: "Probably Skip",
  follow_up_now: "Follow-Up Now",
  prep_mode: "Prep Mode",
  needs_review: "Needs Review",
};

export function AnalyticsStudio() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [insights, setInsights] = useState<InsightResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/application-analytics", { cache: "no-store" }),
      fetch("/api/application-insights", { cache: "no-store" }),
    ]).then(async ([analyticsResponse, insightsResponse]) => {
      if (analyticsResponse.ok) setAnalytics(await analyticsResponse.json());
      if (insightsResponse.ok) setInsights(await insightsResponse.json());
    }).finally(() => setLoading(false));
  }, []);

  const actionReadout = useMemo(() => {
    if (!analytics) return "Save a few roles and Analytics Studio will start finding the signal.";
    if ((analytics.summary.followUpsDue || 0) > 0) return "Follow-ups are the clearest place to recover momentum today.";
    if ((analytics.resumePerformance?.length || 0) > 0) return "Submitted-version tracking is starting to show which materials carry signal.";
    if ((analytics.sourceHealth?.length || 0) > 0) return "Source health is ready for a targeting review.";
    return "Keep logging outcomes gently. The useful patterns need a little more data.";
  }, [analytics]);

  return <AppShell>
    <PageHeading
      eyebrow="Analytics Studio"
      title="What is working?"
      copy="A calm read on source quality, materials, role-fit patterns, follow-up health, and the next adjustment worth making."
      action={<Link href="/applications" className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-sun px-4 py-3 text-sm font-black shadow-pop">Open Applications <ArrowRight size={17} /></Link>}
    />

    {loading ? <div className="mt-7 rounded-3xl border-2 border-ink/15 bg-white/70 p-6 text-sm font-bold text-ink/55">Loading the signal...</div> : null}

    <section className="mt-7 rounded-3xl border-2 border-ink bg-ink p-6 text-cream shadow-soft">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-mint">Studio readout</p>
          <h2 className="mt-1 font-[var(--font-display)] text-2xl font-black">Next useful adjustment</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-cream/75">{actionReadout}</p>
        </div>
        <Sparkles className="text-sun" size={28} />
      </div>
    </section>

    <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Active roles" value={analytics?.summary.total ?? 0} copy={`${analytics?.summary.savedThisWeek ?? 0} saved this week`} />
      <MetricCard label="Response rate" value={`${analytics?.summary.responseRate ?? 0}%`} copy="Roles reaching interview or offer" />
      <MetricCard label="Interview rate" value={`${analytics?.summary.interviewRate ?? 0}%`} copy={`${analytics?.summary.submittedCount ?? 0} submitted roles tracked`} />
      <MetricCard label="Follow-up health" value={`${analytics?.summary.followUpHealth ?? 0}%`} copy={`${analytics?.summary.followUpsDue ?? 0} due now`} />
    </section>

    <section className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <Panel icon={<Radio size={19} />} title="Source Performance" empty="Save roles from a few sources and CareerGroove will show which ones are producing response signal.">
        {analytics?.sourceHealth?.length ? analytics.sourceHealth.map((source) => <BarRow key={source.source} label={source.source} value={`${source.responseRate}%`} width={source.responseRate} copy={`${source.responses} responses · ${source.total} roles`} />)
          : analytics?.sources?.map((source) => <BarRow key={source.source} label={source.source} value={`${source.count}`} width={Math.min(100, source.count * 20)} copy="Roles saved" />)}
      </Panel>

      <Panel icon={<TrendingUp size={19} />} title="Career DJ Mix" empty="Career DJ labels appear once roles are saved and scored.">
        {analytics?.labels?.map((label) => <BarRow key={label.label} label={labelText[label.label] || titleCase(label.label.replaceAll("_", " "))} value={`${label.count}`} width={Math.min(100, label.count * 20)} copy="Current roles" />)}
      </Panel>
    </section>

    <section className="mt-6 grid gap-5 xl:grid-cols-2">
      <Panel icon={<FileText size={19} />} title="Resume Version Signal" empty="Link submitted resumes to outcomes to compare which versions are carrying signal.">
        {analytics?.resumePerformance?.map((item) => <BarRow key={item.version} label={item.version} value={`${item.positiveRate}%`} width={item.positiveRate} copy={`${item.positive} positive · ${item.outcomes} outcomes`} />)}
      </Panel>

      <Panel icon={<BarChart3 size={19} />} title="Role-Fit Trends" empty="Log fit reflections on outcomes to see whether similar roles should move up or down the mix.">
        {analytics?.roleFitTrends?.map((item) => <BarRow key={`${item.roleFit}-${item.similarStrategy}`} label={`${titleCase(item.roleFit)} · ${item.similarStrategy.replace("_", " ")}`} value={`${item.count}`} width={Math.min(100, item.count * 25)} copy="Outcome reflections" />)}
      </Panel>
    </section>

    <section className="mt-6 grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
      <Panel icon={<BarChart3 size={19} />} title="Outcome Mix" empty="Outcomes will appear here when you log rejections, no responses, offers, acceptances, and declines.">
        {analytics?.outcomes?.map((outcome) => <BarRow key={outcome.outcome} label={titleCase(outcome.outcome.replace("_", " "))} value={`${outcome.count}`} width={Math.min(100, outcome.count * 20)} copy="Logged outcomes" />)}
      </Panel>

      <section className="rounded-3xl border-2 border-ink/15 bg-white/75 p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl border-2 border-ink bg-lilac/30"><Sparkles size={19} /></div>
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-plum">Rejection Intelligence</p>
            <h2 className="font-[var(--font-display)] text-xl font-black">Patterns without blame</h2>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {insights?.insights?.length ? insights.insights.slice(0, 4).map((insight) => <article key={insight.id} className="rounded-2xl bg-cream p-4">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-plum">{insight.kind} · {insight.confidence}</p>
            <h3 className="mt-1 font-black">{insight.title}</h3>
            <p className="mt-2 text-sm leading-6 text-ink/65">{insight.suggestion}</p>
          </article>) : <p className="rounded-2xl bg-cream p-4 text-sm font-bold text-ink/55">{insights?.lowData ? "Not enough closed-role history yet. Keep logging outcomes gently." : "No active insights need attention right now."}</p>}
        </div>
      </section>
    </section>
  </AppShell>;
}

function MetricCard({ label, value, copy }: { label: string; value: string | number; copy: string }) {
  return <div className="rounded-3xl border-2 border-ink/15 bg-white p-5">
    <p className="text-xs font-black uppercase tracking-[.18em] text-plum">{label}</p>
    <p className="mt-3 font-[var(--font-display)] text-3xl font-black">{value}</p>
    <p className="mt-1 text-sm font-bold text-ink/55">{copy}</p>
  </div>;
}

function Panel({ icon, title, empty, children }: { icon: React.ReactNode; title: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.filter(Boolean).length > 0 : Boolean(children);
  return <section className="rounded-3xl border-2 border-ink/15 bg-white/75 p-5">
    <div className="flex items-center gap-3">
      <div className="grid size-10 place-items-center rounded-2xl border-2 border-ink bg-mint/50">{icon}</div>
      <h2 className="font-[var(--font-display)] text-xl font-black">{title}</h2>
    </div>
    <div className="mt-4 space-y-3">{hasChildren ? children : <p className="rounded-2xl bg-cream p-4 text-sm font-bold text-ink/55">{empty}</p>}</div>
  </section>;
}

function BarRow({ label, value, width, copy }: { label: string; value: string; width: number; copy: string }) {
  return <div className="rounded-2xl bg-cream p-4">
    <div className="flex items-center justify-between gap-3">
      <p className="truncate font-black">{label}</p>
      <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-black">{value}</span>
    </div>
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
      <div className="h-full rounded-full bg-plum" style={{ width: `${Math.max(5, Math.min(100, width))}%` }} />
    </div>
    <p className="mt-2 text-xs font-bold text-ink/55">{copy}</p>
  </div>;
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}
