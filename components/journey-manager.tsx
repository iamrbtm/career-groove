"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Award,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  GraduationCap,
  Home,
  MessageCircleQuestion,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { AppShell, PageHeading } from "./app-shell";
import { EmptyState } from "./empty-state";
import { parseChapterAI, skillCategories, SkillCategory } from "@/lib/chapter-ai";

type AnyRow = Record<string, any>;
type CredentialKind = "education" | "license" | "certification";

async function json(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  if (response.status === 401)
    throw new Error("Sign in to view and save your private history.");
  const body =
    response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(body?.error || "That change could not be saved.");
  return body;
}

export function JourneyManager() {
  const [jobs, setJobs] = useState<AnyRow[]>([]);
  const [homes, setHomes] = useState<AnyRow[]>([]);
  const [credentials, setCredentials] = useState<AnyRow[]>([]);
  const [skills, setSkills] = useState<AnyRow[]>([]);
  const [selectedJob, setSelectedJob] = useState<AnyRow | null>(null);
  const [selectedHome, setSelectedHome] = useState<AnyRow | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<AnyRow | null>(null);
  const [tab, setTab] = useState("jobs");
  const [credentialTab, setCredentialTab] =
    useState<CredentialKind>("education");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const [j, h, c, s] = await Promise.all([
        json("/api/jobs"),
        json("/api/residences"),
        json("/api/credentials"),
        json("/api/skills"),
      ]);
      setJobs(j.jobs);
      setHomes(h.residences);
      setCredentials(c.credentials);
      setSkills(s.skills);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to load history.",
      );
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>, url: string) {
    event.preventDefault();
    setNotice("");
    const form = event.currentTarget;
    const raw = Object.fromEntries(new FormData(form));
    const body = url.includes("jobs")
      ? {
          ...raw,
          current: raw.current === "on",
          achievements: [],
          metadata: {},
        }
      : url.includes("credentials")
        ? { ...raw, details: {} }
        : raw;
    try {
      await json(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      form.reset();
      await load();
      setNotice("Saved. Your timeline is growing.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Save failed.");
    }
  }

  async function remove(url: string) {
    try {
      await json(url, { method: "DELETE" });
      setSelectedJob(null);
      setSelectedHome(null);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Delete failed.");
    }
  }

  const tabs = [
    { id: "jobs", label: "Work", icon: BriefcaseBusiness },
    { id: "homes", label: "Residences", icon: Home },
    { id: "credentials", label: "Credentials", icon: Award },
    { id: "skills", label: "Skills", icon: BadgeCheck },
  ];
  return (
    <AppShell>
      <PageHeading
        eyebrow="Your journey"
        title="Every chapter counts."
        copy="Keep work, places, education, licenses, and certifications together—ready whenever an application asks."
      />
      <div className="mt-7 flex gap-2 overflow-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 rounded-full border-2 border-ink px-4 py-2 text-sm font-black ${tab === id ? "bg-sun shadow-[0_3px_0_#26312c]" : "bg-white"}`}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </div>
      {notice && (
        <p
          role="status"
          className="mt-4 rounded-2xl bg-coral/15 px-4 py-3 text-sm font-bold"
        >
          {notice}
        </p>
      )}
      <section className={`mt-6 grid items-start gap-6 ${tab === "skills" ? "" : "lg:grid-cols-[.75fr_1.25fr]"}`}>
        <div className="h-fit rounded-3xl border-2 border-ink bg-white p-5 shadow-[0_5px_0_#26312c]">
          {tab === "jobs" && (
            <div>
              <FormTitle icon={<BriefcaseBusiness />} text="Add a work chapter" />
              <p className="text-sm leading-6 text-ink/60">Answer one question at a time. Your interviewer will help uncover the responsibilities, skills, and results worth remembering.</p>
              <Link href="/interview" className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-coral py-3 font-black shadow-[0_4px_0_#26312c]"><Plus size={17}/> Start chapter interview</Link>
            </div>
          )}
          {tab === "homes" && (
            <form
              onSubmit={(event) => submit(event, "/api/residences")}
              className="space-y-3"
            >
              <FormTitle icon={<Home />} text="Add a residence" />
              <Input
                name="label"
                label="Label"
                placeholder="First apartment"
                required
              />
              <Input name="street" label="Street" required />
              <div className="grid grid-cols-2 gap-3">
                <Input name="city" label="City" required />
                <Input name="region" label="State / region" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input name="country" label="Country" required />
                <Input name="postalCode" label="Postal code" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input name="startedOn" label="Start date" type="date" />
                <Input name="endedOn" label="End date" type="date" />
              </div>
              <Submit />
            </form>
          )}
          {tab === "credentials" && (
            <form
              onSubmit={(event) => submit(event, "/api/credentials")}
              className="space-y-3"
            >
              <FormTitle icon={<GraduationCap />} text="Add a credential" />
              <label className="block text-xs font-black uppercase tracking-wider text-plum">
                Type
                <select
                  name="kind"
                  value={credentialTab}
                  onChange={(event) =>
                    setCredentialTab(event.target.value as CredentialKind)
                  }
                  className="mt-1 w-full rounded-xl border-2 border-ink/15 px-3 py-2.5 text-sm normal-case"
                >
                  <option value="education">Education</option>
                  <option value="license">License</option>
                  <option value="certification">Certification</option>
                </select>
              </label>
              <Input name="name" label="Name" required />
              <Input name="issuer" label="School or issuer" />
              <div className="grid grid-cols-2 gap-3">
                <Input name="issuedOn" label="Issued" type="date" />
                <Input name="expiresOn" label="Expires" type="date" />
              </div>
              <Submit />
            </form>
          )}
          {tab === "skills" && (
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div><FormTitle icon={<BadgeCheck />} text="Your skill board" />
              <p className="max-w-2xl text-sm leading-6 text-ink/60">Skills are grouped by category. Select any card to update its name, proficiency, or category.</p></div>
              <Link href="/interview" className="flex shrink-0 items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-coral px-5 py-3 font-black shadow-[0_4px_0_#26312c]"><Plus size={17}/> Add a work chapter</Link>
            </div>
          )}
        </div>
        <div>
          {tab === "jobs" &&
            (jobs.length ? (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onView={() => setSelectedJob(job)}
                    onDelete={() => remove(`/api/jobs/${job.id}`)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState>
                Add your first role or use the AI Interviewer.
              </EmptyState>
            ))}
          {tab === "homes" &&
            (homes.length ? (
              <div className="space-y-3">
                {homes.map((home) => (
                  <ResidenceCard
                    key={home.id}
                    home={home}
                    onEdit={() => setSelectedHome(home)}
                    onDelete={() => remove(`/api/residences/${home.id}`)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState>
                Add a residence to make future forms painless.
              </EmptyState>
            ))}
          {tab === "credentials" && (
            <CredentialTabs
              credentials={credentials}
              selected={credentialTab}
              onSelect={setCredentialTab}
              onDelete={(id) => remove(`/api/credentials/${id}`)}
            />
          )}
          {tab === "skills" &&
            (skills.length ? (
              <SkillBoard skills={skills} onSelect={setSelectedSkill}/>
            ) : (
              <EmptyState>Complete a work chapter interview and your discovered skills will appear here.</EmptyState>
            ))}
        </div>
      </section>
      {selectedJob && (
        <ChapterEditor
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onSaved={async (job) => {
            setSelectedJob(job);
            await load();
            setNotice("Chapter updated.");
          }}
        />
      )}
      {selectedHome && (
        <ResidenceEditor
          home={selectedHome}
          onClose={() => setSelectedHome(null)}
          onSaved={async () => {
            setSelectedHome(null);
            await load();
            setNotice("Residence updated.");
          }}
        />
      )}
      {selectedSkill && (
        <SkillEditor
          skill={selectedSkill}
          onClose={() => setSelectedSkill(null)}
          onSaved={async () => { setSelectedSkill(null); await load(); setNotice("Skill updated."); }}
          onDeleted={async () => { setSelectedSkill(null); await load(); setNotice("Skill deleted."); }}
        />
      )}
    </AppShell>
  );
}

const proficiencyLabels = ["", "Learning", "Beginner", "Proficient", "Advanced", "Expert"];
const categoryEntries = Object.entries(skillCategories) as [SkillCategory, string][];

const credentialTabs: {
  id: CredentialKind;
  label: string;
  empty: string;
  icon: typeof GraduationCap;
}[] = [
  {
    id: "education",
    label: "Education",
    empty: "Add your education history to keep it ready for applications.",
    icon: GraduationCap,
  },
  {
    id: "license",
    label: "Licenses",
    empty: "Add your first professional license.",
    icon: BadgeCheck,
  },
  {
    id: "certification",
    label: "Certifications",
    empty: "Add your first certification.",
    icon: Award,
  },
];

function CredentialTabs({
  credentials,
  selected,
  onSelect,
  onDelete,
}: {
  credentials: AnyRow[];
  selected: CredentialKind;
  onSelect: (kind: CredentialKind) => void;
  onDelete: (id: string) => void;
}) {
  const activeTab = credentialTabs.find((item) => item.id === selected)!;
  const visibleCredentials = credentials.filter(
    (credential) => credential.kind === selected,
  );

  return (
    <div>
      <div
        className="mb-4 flex gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label="Credential types"
      >
        {credentialTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected === id}
            onClick={() => onSelect(id)}
            className={`flex shrink-0 items-center gap-2 rounded-2xl border-2 px-3 py-2 text-sm font-black transition ${
              selected === id
                ? "border-ink bg-mint shadow-[0_3px_0_#26312c]"
                : "border-ink/15 bg-white/70 text-ink/60 hover:border-ink/40"
            }`}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </div>
      {visibleCredentials.length ? (
        <div className="space-y-3" role="tabpanel">
          {visibleCredentials.map((credential) => (
            <Card
              key={credential.id}
              icon={<activeTab.icon />}
              title={credential.name}
              sub={credential.issuer || "No issuer"}
              onDelete={() => onDelete(credential.id)}
            />
          ))}
        </div>
      ) : (
        <div role="tabpanel">
          <EmptyState>{activeTab.empty}</EmptyState>
        </div>
      )}
    </div>
  );
}

function SkillBoard({ skills, onSelect }: { skills: AnyRow[]; onSelect: (skill: AnyRow) => void }) {
  return <div className="overflow-x-auto pb-4"><div className="grid min-w-[1120px] grid-cols-6 gap-4">
    {categoryEntries.map(([category, label]) => {
      const columnSkills = skills.filter((skill) => (skill.category || "other") === category);
      return <section key={category} className="min-h-72 rounded-3xl border-2 border-ink/15 bg-white/55 p-3">
        <div className="flex items-start justify-between gap-2 px-1 py-2"><h3 className="text-xs font-black uppercase leading-5 tracking-wider text-plum">{label}</h3><span className="rounded-full bg-ink px-2 py-0.5 text-xs font-black text-cream">{columnSkills.length}</span></div>
        <div className="mt-2 space-y-3">{columnSkills.map((skill) => <button key={skill.id} type="button" onClick={() => onSelect(skill)} className="w-full rounded-2xl border-2 border-ink/15 bg-white p-3 text-left shadow-[0_3px_0_rgba(38,49,44,.14)] transition hover:-translate-y-0.5 hover:border-coral focus:outline-none focus:ring-2 focus:ring-coral">
          <span className="block text-sm font-black leading-5">{skill.name}</span>
          <span className="mt-2 block text-xs font-bold text-ink/50">{proficiencyLabels[Number(skill.proficiency)] || "Unrated"}</span>
        </button>)}</div>
      </section>;
    })}
  </div></div>;
}

function SkillEditor({ skill, onClose, onSaved, onDeleted }: { skill: AnyRow; onClose: () => void; onSaved: () => Promise<void>; onDeleted: () => Promise<void> }) {
  const [name, setName] = useState(skill.name);
  const [proficiency, setProficiency] = useState(Number(skill.proficiency));
  const [category, setCategory] = useState<SkillCategory>(skill.category || "other");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      await json(`/api/skills/${skill.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, proficiency, category }) });
      await onSaved();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Skill update failed."); }
    finally { setSaving(false); }
  }
  async function removeSkill() {
    setSaving(true); setError("");
    try { await json(`/api/skills/${skill.id}`, { method: "DELETE" }); await onDeleted(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Skill deletion failed."); setSaving(false); }
  }
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Edit ${skill.name}`}>
    <form onSubmit={save} className="w-full max-w-lg rounded-4xl border-2 border-ink bg-cream p-6 shadow-pop md:p-8">
      <div className="flex items-start justify-between gap-4"><div className="flex gap-3"><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sun/50"><BadgeCheck size={21}/></div><div><p className="text-xs font-black uppercase tracking-[.2em] text-plum">Edit skill</p><h2 className="font-[var(--font-display)] text-2xl font-black">Tune this skill</h2></div></div><button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full bg-white" aria-label="Close skill editor"><X/></button></div>
      <div className="mt-6">
        <label className="block text-xs font-black uppercase tracking-wider text-plum">Skill name<input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-xl border-2 border-ink/15 bg-white px-3 py-3 text-sm font-bold normal-case outline-none focus:border-coral"/></label>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-black uppercase tracking-wider text-plum">Proficiency<select value={proficiency} onChange={(event) => setProficiency(Number(event.target.value))} className="mt-1 w-full rounded-xl border-2 border-ink/15 bg-white px-3 py-2.5 text-sm font-bold normal-case outline-none focus:border-coral">{proficiencyLabels.slice(1).map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select></label>
          <label className="block text-xs font-black uppercase tracking-wider text-plum">Category<select value={category} onChange={(event) => setCategory(event.target.value as SkillCategory)} className="mt-1 w-full rounded-xl border-2 border-ink/15 bg-white px-3 py-2.5 text-sm font-bold normal-case outline-none focus:border-coral">{categoryEntries.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <p className="mt-4 text-xs font-bold text-ink/45">Used in {skill.chapterCount} work {skill.chapterCount === 1 ? "chapter" : "chapters"}</p>
        {error && <p className="mt-2 text-xs font-bold text-coral">{error}</p>}
      </div>
      <div className="mt-6 flex items-center gap-3"><button type="button" onClick={removeSkill} disabled={saving} className="grid size-12 place-items-center rounded-2xl border-2 border-ink/15 bg-white text-ink/50 hover:border-coral hover:text-coral" aria-label={`Delete ${skill.name}`} title="Delete skill"><Trash2 size={19}/></button><button type="button" onClick={onClose} className="ml-auto rounded-2xl px-4 py-3 text-sm font-black">Cancel</button><button disabled={saving || !name.trim()} className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-mint px-5 py-3 text-sm font-black shadow-[0_3px_0_#26312c] disabled:opacity-50"><Save size={17}/>{saving ? "Saving…" : "Save changes"}</button></div>
    </form>
  </div>;
}

function ChapterEditor({
  job,
  onClose,
  onSaved,
}: {
  job: AnyRow;
  onClose: () => void;
  onSaved: (job: AnyRow) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [error, setError] = useState("");
  const [polished, setPolished] = useState(job.metadata?.polishedChapter || (job.achievements || []).map((item: string) => `• ${item}`).join("\n"));
  const [achievements, setAchievements] = useState((job.achievements || []).join("\n"));
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const raw = Object.fromEntries(new FormData(event.currentTarget));
    const achievementLines = String(raw.achievements || "")
      .split("\n")
      .map((line) => line.replace(/^\s*[-*•]+\s*/, "").trim())
      .filter(Boolean);
    const metadata = {
      ...(job.metadata || {}),
      polishedChapter: String(raw.polishedChapter || ""),
    };
    const body = {
      company: raw.company,
      title: raw.title,
      location: raw.location,
      startedOn: raw.startedOn,
      endedOn: raw.endedOn,
      current: raw.current === "on",
      rawNotes: raw.rawNotes,
      achievements: achievementLines,
      metadata,
    };
    try {
      let result = await json(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      try {
        const providerData = await json("/api/providers");
        const activeConnections = (providerData.connections as AnyRow[]).filter((connection) => connection.active && connection.selectedModel);
        const connection = activeConnections.find((item) => item.provider === providerData.defaultProvider) || activeConnections[0];
        if (connection) {
          const aiResponse = await fetch("/api/ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provider: connection.provider,
              purpose: "job-interviewer",
              context: { company: body.company, title: body.title },
              messages: [{ role: "user", content: `Analyze this saved work chapter and return resume bullets plus every supported skill and category. Chapter: ${JSON.stringify(body)}` }],
            }),
          });
          if (aiResponse.ok) {
            const inferredSkills = parseChapterAI(await aiResponse.text()).skills;
            if (inferredSkills.length) {
              result = await json(`/api/jobs/${job.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...body, inferredSkills }),
              });
            }
          }
        }
      } catch (aiError) {
        console.warn("Chapter saved without refreshing skills", aiError);
      }
      await onSaved(result.job);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Chapter update failed.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function reprocess(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (!form) return;
    const raw = Object.fromEntries(new FormData(form));
    setReprocessing(true); setError("");
    try {
      const result = await json(`/api/jobs/${job.id}/reprocess`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: raw.company, title: raw.title, location: raw.location, rawNotes: raw.rawNotes }),
      });
      setPolished(result.job.metadata?.polishedChapter || "");
      setAchievements((result.job.achievements || []).join("\n"));
      await onSaved(result.job);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Re-processing failed."); }
    finally { setReprocessing(false); }
  }
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-ink/55 p-3 backdrop-blur-sm md:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Edit work chapter"
    >
      <form
        onSubmit={save}
        className="mx-auto max-w-3xl rounded-4xl border-2 border-ink bg-cream p-5 shadow-pop md:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-plum">
              Full work chapter
            </p>
            <h2 className="font-[var(--font-display)] text-2xl font-black">
              View and edit your story
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-full bg-white"
            aria-label="Close chapter"
          >
            <X />
          </button>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Input
            name="company"
            label="Company"
            required
            defaultValue={job.company}
          />
          <Input name="title" label="Title" required defaultValue={job.title} />
          <Input
            name="location"
            label="Location"
            defaultValue={job.location || ""}
          />
          <label className="flex items-end gap-2 pb-3 text-sm font-bold">
            <input
              type="checkbox"
              name="current"
              defaultChecked={job.current}
              className="accent-coral"
            />
            I work here now
          </label>
          <Input
            name="startedOn"
            label="Started"
            type="date"
            defaultValue={job.startedOn?.slice(0, 10) || ""}
          />
          <Input
            name="endedOn"
            label="Ended"
            type="date"
            defaultValue={job.endedOn?.slice(0, 10) || ""}
          />
        </div>
        <TextArea
          name="rawNotes"
          label="Original story"
          defaultValue={job.rawNotes || ""}
        />
        <TextArea
          name="polishedChapter"
          label="Full polished chapter"
          value={polished}
          onChange={setPolished}
          tall
        />
        <TextArea
          name="achievements"
          label="Resume bullets — one per line"
          value={achievements}
          onChange={setAchievements}
          tall
        />
        {error && (
          <p className="mt-4 rounded-2xl bg-coral/20 p-3 text-sm font-bold">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <div className="mr-auto flex flex-wrap gap-3">
          <Link href={`/interview?jobId=${job.id}`} className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-coral px-5 py-3 text-sm font-black shadow-[0_3px_0_#26312c]">
            <MessageCircleQuestion size={17}/> Re-interview
          </Link>
          <button type="button" onClick={reprocess} disabled={saving || reprocessing} className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-mint px-5 py-3 text-sm font-black shadow-[0_3px_0_#26312c] disabled:opacity-50">
            <RefreshCw size={17} className={reprocessing ? "animate-spin" : ""}/>{reprocessing ? "Re-processing…" : "Re-process with AI"}
          </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl px-5 py-3 text-sm font-black"
          >
            Cancel
          </button>
          <button
            disabled={saving}
            className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-sun px-5 py-3 text-sm font-black shadow-[0_3px_0_#26312c]"
          >
            <Save size={17} />
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

function formatNumericMonthYear(value?: string | null) {
  if (!value) return null;
  const [year, month] = value.slice(0, 10).split("-");
  if (!year || !month) return null;
  return `${month.padStart(2, "0")}/${year.slice(-2)}`;
}

function JobCard({
  job,
  onView,
  onDelete,
}: {
  job: AnyRow;
  onView: () => void;
  onDelete: () => void;
}) {
  const startedOn = formatNumericMonthYear(job.startedOn);
  const endedOn = formatNumericMonthYear(job.endedOn);
  const dateRange = startedOn
    ? `${startedOn} – ${job.current || !endedOn ? "Present" : endedOn}`
    : endedOn
      ? `— – ${endedOn}`
      : null;

  return (
    <article className="rounded-3xl border-2 border-ink/15 bg-white/70 p-5">
      <div className="flex gap-4">
        <button
          onClick={onView}
          className="grid size-11 shrink-0 place-items-center rounded-2xl bg-mint/40"
          aria-label={`View ${job.title}`}
        >
          <BriefcaseBusiness />
        </button>
        <button onClick={onView} className="min-w-0 flex-1 text-left">
          <div className="flex min-w-0 items-baseline justify-between gap-3">
            <h3
              className="min-w-0 truncate font-[var(--font-display)] text-lg font-black"
              title={job.title}
            >
              {job.title}
            </h3>
            {dateRange && (
              <span className="shrink-0 text-xs font-black tabular-nums text-plum">
                {dateRange}
              </span>
            )}
          </div>
          <p className="text-sm text-ink/55">
            {job.company}
            {job.location ? ` · ${job.location}` : ""}
          </p>
          {job.achievements?.slice(0, 3).map((item: string) => (
            <p
              key={item}
              className="mt-2 text-sm before:mr-2 before:text-coral before:content-['•']"
            >
              {item}
            </p>
          ))}
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-black text-plum">
            View and edit full chapter <ChevronRight size={15} />
          </span>
        </button>
        <button
          onClick={onDelete}
          aria-label={`Delete ${job.title}`}
          className="self-start text-ink/30 hover:text-coral"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </article>
  );
}
function Input(props: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  const { label, ...input } = props;
  return (
    <label className="block text-xs font-black uppercase tracking-wider text-plum">
      {label}
      <input
        {...input}
        className="mt-1 w-full rounded-xl border-2 border-ink/15 px-3 py-2.5 text-sm font-bold normal-case outline-none focus:border-coral"
      />
    </label>
  );
}
function TextArea({
  name,
  label,
  defaultValue,
  value,
  onChange,
  tall = false,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  tall?: boolean;
}) {
  return (
    <label className="mt-5 block text-xs font-black uppercase tracking-wider text-plum">
      {label}
      <textarea
        name={name}
        defaultValue={value === undefined ? defaultValue : undefined}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className={`mt-1 w-full resize-y rounded-2xl border-2 border-ink/15 bg-white p-4 text-sm font-medium normal-case leading-6 outline-none focus:border-coral ${tall ? "min-h-48" : "min-h-28"}`}
      />
    </label>
  );
}
function FormTitle({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 font-[var(--font-display)] text-xl font-black">
      {icon}
      {text}
    </h2>
  );
}
function Submit() {
  return (
    <button className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-coral py-3 font-black shadow-[0_4px_0_#26312c]">
      <Plus size={17} />
      Save chapter
    </button>
  );
}
function Card({
  icon,
  title,
  sub,
  onDelete,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-3xl border-2 border-ink/15 bg-white/70 p-5">
      <div className="flex gap-4">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-mint/40">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-[var(--font-display)] text-lg font-black">
            {title}
          </h3>
          <p className="text-sm text-ink/55">{sub}</p>
        </div>
        <button
          onClick={onDelete}
          aria-label={`Delete ${title}`}
          className="self-start text-ink/30 hover:text-coral"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </article>
  );
}

function formatMonthYear(value?: string | null) {
  if (!value) return null;
  const [year, month] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function ResidenceCard({
  home,
  onEdit,
  onDelete,
}: {
  home: AnyRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const addressLineOne = home.address?.street || "Address not provided";
  const city = home.address?.city || "";
  const regionAndPostal = [home.address?.region, home.address?.postalCode]
    .filter(Boolean)
    .join(" ");
  const addressLineTwo = [city, regionAndPostal].filter(Boolean).join(", ");
  const startedOn = formatMonthYear(home.startedOn);
  const endedOn = formatMonthYear(home.endedOn);

  return (
    <article className="rounded-3xl border-2 border-ink/15 bg-white/70 p-5">
      <div className="flex items-start gap-4">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-mint/40">
          <Home />
        </div>
        <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <address className="not-italic text-sm leading-5 text-ink/55">
              <span className="block break-words font-black text-ink">
                {addressLineOne}
              </span>
              <span className="block break-words">{addressLineTwo}</span>
            </address>
          </div>
          <div
            className="flex items-center gap-2 text-xs font-bold text-ink/65 sm:justify-end"
            aria-label={`Residence dates: ${startedOn || "start date not set"} to ${endedOn || "present"}`}
          >
            <CalendarDays size={17} className="shrink-0 text-plum" />
            <span>{startedOn || "Not set"}</span>
            <span aria-hidden="true" className="text-ink/30">→</span>
            <span>{endedOn || "Present"}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${home.label || addressLineOne}`}
            className="text-ink/30 hover:text-plum"
          >
            <Pencil size={18} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${home.label || addressLineOne}`}
            className="text-ink/30 hover:text-coral"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </article>
  );
}

function ResidenceEditor({
  home,
  onClose,
  onSaved,
}: {
  home: AnyRow;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await json(`/api/residences/${home.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Edit residence"
    >
      <form
        onSubmit={save}
        className="w-full max-w-xl rounded-4xl border-2 border-ink bg-cream p-6 shadow-pop md:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-mint/40">
              <Home size={21} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[.2em] text-plum">
                Residence
              </p>
              <h2 className="font-[var(--font-display)] text-2xl font-black">
                Edit this address
              </h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close residence editor" className="grid size-10 place-items-center rounded-full bg-white">
            <X />
          </button>
        </div>
        <div className="mt-6 space-y-3">
          <Input name="label" label="Label" required defaultValue={home.label || ""} />
          <Input name="street" label="Street" required defaultValue={home.address?.street || ""} />
          <div className="grid grid-cols-2 gap-3">
            <Input name="city" label="City" required defaultValue={home.address?.city || ""} />
            <Input name="region" label="State / region" defaultValue={home.address?.region || ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input name="country" label="Country" required defaultValue={home.address?.country || ""} />
            <Input name="postalCode" label="Postal code" defaultValue={home.address?.postalCode || ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input name="startedOn" label="Start date" type="date" defaultValue={home.startedOn?.slice(0, 10) || ""} />
            <Input name="endedOn" label="End date" type="date" defaultValue={home.endedOn?.slice(0, 10) || ""} />
          </div>
        </div>
        {error && <p className="mt-4 rounded-2xl bg-coral/20 p-3 text-sm font-bold">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-2xl px-5 py-3 text-sm font-black">Cancel</button>
          <button disabled={saving} className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-mint px-5 py-3 text-sm font-black shadow-[0_3px_0_#26312c] disabled:opacity-50">
            <Save size={17} />
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
