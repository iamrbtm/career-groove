"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, Github, Globe, Linkedin, LoaderCircle, RefreshCw, Save, Sparkles, User } from "lucide-react";
import { AppShell, PageHeading } from "./app-shell";
import { MotionButton } from "./motion-button";

type BrandProfile = {
  linkedinHeadline: string | null;
  linkedinAbout: string | null;
  githubBio: string | null;
  portfolioBio: string | null;
  personalStatement: string | null;
  brandKeywords: string[];
  consistencyScore: number | null;
  lastScoredAt: string | null;
};

type ScoreResult = {
  score: number;
  gaps: string[];
  recommendations: string[];
  breakdown: Record<string, string>;
};

const scoreColor = (score: number) => {
  if (score >= 80) return "text-mint";
  if (score >= 50) return "text-sun";
  return "text-coral";
};

const scoreBg = (score: number) => {
  if (score >= 80) return "bg-mint/20";
  if (score >= 50) return "bg-sun/20";
  return "bg-coral/20";
};

export function BrandStudio() {
  const [activeTab, setActiveTab] = useState<"linkedin" | "github" | "statement" | "score">("linkedin");
  const [profile, setProfile] = useState<BrandProfile>({
    linkedinHeadline: null, linkedinAbout: null, githubBio: null,
    portfolioBio: null, personalStatement: null, brandKeywords: [],
    consistencyScore: null, lastScoredAt: null,
  });
  const [score, setScore] = useState<ScoreResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [editHeadline, setEditHeadline] = useState("");
  const [editAbout, setEditAbout] = useState("");
  const [editGithub, setEditGithub] = useState("");
  const [editStatement, setEditStatement] = useState("");
  const [editKeywords, setEditKeywords] = useState("");

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/brand");
      if (res.ok) {
        const data = await res.json();
        const bp = data.brandProfile;
        if (bp) {
          setProfile(bp);
          setEditHeadline(bp.linkedinHeadline || "");
          setEditAbout(bp.linkedinAbout || "");
          setEditGithub(bp.githubBio || "");
          setEditStatement(bp.personalStatement || "");
          setEditKeywords((bp.brandKeywords || []).join(", "));
        }
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  async function generateLinkedIn(action: "headline" | "about" | "all") {
    setGenerating(`linkedin-${action}`);
    setNotice("");
    try {
      const res = await fetch("/api/brand/linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed.");

      if (action === "headline" || action === "all") {
        const lines = data.content.split("\n").filter((l: string) => l.trim());
        const headlines = lines.filter((l: string) => l.length < 220 && !l.startsWith("SKILLS") && !l.startsWith("ABOUT") && !l.startsWith("HEADLINE"));
        if (headlines.length > 0) setEditHeadline(headlines[0]);
      }
      if (action === "about" || action === "all") {
        const lines = data.content.split("\n");
        const aboutStart = lines.findIndex((l: string) => l.startsWith("ABOUT") || l.startsWith("HEADLINE"));
        const aboutContent = aboutStart >= 0 ? lines.slice(aboutStart + 1).filter((l: string) => !l.startsWith("SKILLS")).join("\n").trim() : data.content;
        if (aboutContent) setEditAbout(aboutContent);
      }
      setNotice("LinkedIn content generated! Review and save below.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not generate.");
    } finally {
      setGenerating(null);
    }
  }

  async function generateGitHub(action: "bio" | "profile") {
    setGenerating(`github-${action}`);
    setNotice("");
    try {
      const res = await fetch("/api/brand/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed.");
      if (action === "bio") setEditGithub(data.content.slice(0, 160));
      setNotice("GitHub content generated!");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not generate.");
    } finally {
      setGenerating(null);
    }
  }

  async function saveProfile() {
    setSaving(true);
    setNotice("");
    try {
      const keywords = editKeywords.split(",").map((k) => k.trim()).filter(Boolean);
      const res = await fetch("/api/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkedinHeadline: editHeadline || null,
          linkedinAbout: editAbout || null,
          githubBio: editGithub || null,
          personalStatement: editStatement || null,
          brandKeywords: keywords,
        }),
      });
      if (!res.ok) throw new Error("Save failed.");
      setNotice("Brand profile saved!");
      await loadProfile();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function runScore() {
    setGenerating("score");
    setNotice("");
    try {
      const res = await fetch("/api/brand/score", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scoring failed.");
      setScore(data);
      setNotice(`Consistency score: ${data.score}/100. ${data.gaps.length > 0 ? data.gaps.length + " improvement areas found." : "Looking great!"}`);
      await loadProfile();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not score.");
    } finally {
      setGenerating(null);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="grid min-h-[50vh] place-items-center">
          <LoaderCircle size={32} className="animate-spin text-plum" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeading
        eyebrow="Brand Studio"
        title="Polish your professional presence."
        copy="Optimize your LinkedIn, GitHub, and personal brand for the roles you want. AI generates suggestions based on your actual experience."
      />

      <div className="mt-5 flex items-center gap-2">
        {profile.consistencyScore !== null && (
          <span className={`rounded-full px-4 py-2 text-sm font-black ${scoreBg(profile.consistencyScore)} ${scoreColor(profile.consistencyScore)}`}>
            Score: {profile.consistencyScore}/100
          </span>
        )}
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
        {[
          { id: "linkedin" as const, label: "LinkedIn", icon: Linkedin },
          { id: "github" as const, label: "GitHub", icon: Github },
          { id: "statement" as const, label: "Statement", icon: User },
          { id: "score" as const, label: "Score & audit", icon: BarChart3 },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black whitespace-nowrap ${
              activeTab === tab.id ? "border-2 border-ink bg-mint shadow-[0_4px_0_#26312c]" : "border-2 border-ink/10 bg-cream"
            }`}>
            <tab.icon size={18} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-6">
        {activeTab === "linkedin" && (
          <div className="space-y-5">
            <div className="rounded-3xl border-2 border-ink bg-white p-6 shadow-[0_5px_0_#26312c]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-[var(--font-display)] text-xl font-black">LinkedIn headline</h3>
                  <p className="mt-1 text-sm text-ink/55">The first thing recruiters see. Max 220 characters.</p>
                </div>
                <MotionButton onClick={() => generateLinkedIn("headline")} disabled={generating === "linkedin-headline"}
                  className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-sun px-4 py-2 text-sm font-black disabled:opacity-60">
                  {generating === "linkedin-headline" ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  Generate
                </MotionButton>
              </div>
              <textarea value={editHeadline} onChange={(e) => setEditHeadline(e.target.value.slice(0, 220))}
                className="mt-4 min-h-[60px] w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none"
                placeholder="e.g., Senior Frontend Engineer | React, TypeScript, UI Architecture" />
              <p className="mt-1 text-right text-[10px] font-bold text-ink/40">{editHeadline.length}/220</p>
            </div>

            <div className="rounded-3xl border-2 border-ink bg-white p-6 shadow-[0_5px_0_#26312c]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-[var(--font-display)] text-xl font-black">LinkedIn About section</h3>
                  <p className="mt-1 text-sm text-ink/55">Your career story in 2-3 paragraphs. Recruiters read this.</p>
                </div>
                <MotionButton onClick={() => generateLinkedIn("about")} disabled={generating === "linkedin-about"}
                  className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-sun px-4 py-2 text-sm font-black disabled:opacity-60">
                  {generating === "linkedin-about" ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  Generate
                </MotionButton>
              </div>
              <textarea value={editAbout} onChange={(e) => setEditAbout(e.target.value)}
                className="mt-4 min-h-40 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none"
                placeholder="Write your About section here..." />
            </div>
          </div>
        )}

        {activeTab === "github" && (
          <div className="space-y-5">
            <div className="rounded-3xl border-2 border-ink bg-white p-6 shadow-[0_5px_0_#26312c]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-[var(--font-display)] text-xl font-black">GitHub bio</h3>
                  <p className="mt-1 text-sm text-ink/55">Your profile bio visible to everyone. Max 160 characters.</p>
                </div>
                <MotionButton onClick={() => generateGitHub("bio")} disabled={generating === "github-bio"}
                  className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-sun px-4 py-2 text-sm font-black disabled:opacity-60">
                  {generating === "github-bio" ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  Generate
                </MotionButton>
              </div>
              <input value={editGithub} onChange={(e) => setEditGithub(e.target.value.slice(0, 160))}
                className="mt-4 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none"
                placeholder="e.g., building tools that make devs faster. React, TS, Node." />
              <p className="mt-1 text-right text-[10px] font-bold text-ink/40">{editGithub.length}/160</p>
            </div>
          </div>
        )}

        {activeTab === "statement" && (
          <div className="space-y-5">
            <div className="rounded-3xl border-2 border-ink bg-white p-6 shadow-[0_5px_0_#26312c]">
              <h3 className="font-[var(--font-display)] text-xl font-black">Personal statement</h3>
              <p className="mt-1 text-sm text-ink/55">A 2-3 sentence summary of who you are professionally. Used as the anchor for all your brand content.</p>
              <textarea value={editStatement} onChange={(e) => setEditStatement(e.target.value)}
                className="mt-4 min-h-28 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none"
                placeholder="e.g., Product-minded engineer with 8+ years building scalable web applications..." />
            </div>

            <div className="rounded-3xl border-2 border-ink bg-white p-6 shadow-[0_5px_0_#26312c]">
              <h3 className="font-[var(--font-display)] text-xl font-black">Brand keywords</h3>
              <p className="mt-1 text-sm text-ink/55">Comma-separated keywords that define your professional brand. These will be checked for consistency across platforms.</p>
              <input value={editKeywords} onChange={(e) => setEditKeywords(e.target.value)}
                className="mt-4 w-full rounded-2xl bg-cream px-4 py-3 text-sm font-bold outline-none"
                placeholder="e.g., React, TypeScript, Product Strategy, Team Leadership, System Design" />
            </div>
          </div>
        )}

        {activeTab === "score" && (
          <div className="space-y-5">
            <div className="rounded-3xl border-2 border-ink bg-white p-6 shadow-[0_5px_0_#26312c]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-[var(--font-display)] text-xl font-black">Brand consistency audit</h3>
                  <p className="mt-1 text-sm text-ink/55">Checks your LinkedIn, GitHub, and statement for alignment. A high score means recruiters see a consistent story everywhere.</p>
                </div>
                <MotionButton onClick={runScore} disabled={generating === "score"}
                  className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-plum px-4 py-2 text-sm font-black text-white disabled:opacity-60">
                  {generating === "score" ? <LoaderCircle size={16} className="animate-spin" /> : <BarChart3 size={16} />}
                  Run audit
                </MotionButton>
              </div>

              {score && (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className={`grid size-20 place-items-center rounded-full text-3xl font-black ${scoreColor(score.score)} ${scoreBg(score.score)}`}>
                      {score.score}
                    </div>
                    <div>
                      <p className="font-black">
                        {score.score >= 80 ? "Strong alignment" : score.score >= 50 ? "Some gaps found" : "Needs attention"}
                      </p>
                      <p className="text-sm text-ink/55">
                        {score.score >= 80 ? "Your professional brand tells a consistent story." :
                         score.score >= 50 ? "A few areas need attention to tell a unified story." :
                         "Your brand elements are disconnected. Focus on alignment."}
                      </p>
                    </div>
                  </div>

                  {score.gaps.length > 0 && (
                    <div>
                      <p className="flex items-center gap-2 text-sm font-black text-coral"><AlertTriangle size={16} /> Gaps found</p>
                      <ul className="mt-2 space-y-2">
                        {score.gaps.map((gap, i) => (
                          <li key={i} className="flex gap-3 rounded-xl bg-coral/5 p-3 text-sm leading-5 text-ink/70">
                            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-coral/20 text-[10px] font-black text-coral">!</span>
                            {gap}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {score.recommendations.length > 0 && (
                    <div>
                      <p className="flex items-center gap-2 text-sm font-black text-plum"><Sparkles size={16} /> Recommendations</p>
                      <ul className="mt-2 space-y-2">
                        {score.recommendations.map((rec, i) => (
                          <li key={i} className="flex gap-3 rounded-xl bg-plum/5 p-3 text-sm leading-5 text-ink/70">
                            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-plum/20 text-[10px] font-black text-plum">{i + 1}</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {Object.entries(score.breakdown).map(([key, value]) => {
                      const colors: Record<string, string> = {
                        good: "bg-mint text-ink",
                        present: "bg-sun text-ink",
                        needs_work: "bg-coral/20 text-coral",
                        missing: "bg-ink/10 text-ink/40",
                      };
                      const labels: Record<string, string> = {
                        headline: "Headline", about: "About", github: "GitHub bio",
                        statement: "Statement", keywords: "Keywords",
                      };
                      return (
                        <div key={key} className="rounded-xl bg-cream p-3 text-center">
                          <p className="text-[10px] font-black uppercase tracking-[.16em] text-ink/55">{labels[key] || key}</p>
                          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-black ${colors[value] || "bg-ink/10"}`}>
                            {value.replace("_", " ")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!score && (
                <div className="mt-6 rounded-2xl border-2 border-dashed border-ink/20 bg-cream p-6 text-center">
                  <BarChart3 size={24} className="mx-auto text-plum" />
                  <p className="mt-2 text-sm font-bold text-ink/55">Run an audit to see your brand consistency score and improvement areas.</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <MotionButton onClick={saveProfile} disabled={saving}
            className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-mint px-6 py-3 text-sm font-black shadow-[0_4px_0_#26312c] disabled:opacity-60">
            {saving ? <LoaderCircle size={18} className="animate-spin" /> : <Save size={18} />}
            Save brand profile
          </MotionButton>
          <button onClick={loadProfile} className="rounded-2xl border-2 border-ink/15 bg-cream px-4 py-3 text-sm font-black">
            <RefreshCw size={18} />
          </button>
        </div>

        {notice && (
          <div className="rounded-2xl bg-mint/30 p-4 text-sm font-bold">{notice}</div>
        )}
      </div>
    </AppShell>
  );
}
