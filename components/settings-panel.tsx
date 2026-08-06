"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Github, Headphones, Mail, Send, ShieldCheck } from "lucide-react";
import { AppShell, PageHeading } from "./app-shell";
import { DefaultAISelector } from "./default-ai-selector";
import { ProviderConnections } from "./provider-connections";

type EmailProvider = "gmail" | "icloud" | "yahoo" | "outlook" | "smtp" | "";

const EMAIL_PROVIDER_PRESETS: Record<
  Exclude<EmailProvider, "smtp" | "">,
  { smtpHost: string; smtpPort: number; label: string; note: string }
> = {
  gmail: {
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    label: "Gmail",
    note: "Go to your Google Account -> Security -> 2-Step Verification -> App passwords. Generate one for 'Mail' and paste it in the Password field below.",
  },
  icloud: {
    smtpHost: "smtp.mail.me.com",
    smtpPort: 587,
    label: "iCloud",
    note: "Sign in at appleid.apple.com → Sign-In and Security → App-Specific Passwords. Generate one and paste it in the Password field below.",
  },
  yahoo: {
    smtpHost: "smtp.mail.yahoo.com",
    smtpPort: 587,
    label: "Yahoo",
    note: "In Yahoo Mail go to Account Security -> Generate app password. Select 'Other App', then paste the password below.",
  },
  outlook: {
    smtpHost: "smtp-mail.outlook.com",
    smtpPort: 587,
    label: "Outlook",
    note: "Use your regular Outlook password. If two-factor authentication is on, generate an app password at account.microsoft.com → Security.",
  },
};

type EmailFormState = {
  provider: EmailProvider;
  senderName: string;
  email: string;
  smtpHost: string;
  smtpPort: string;
  smtpUsername: string;
  smtpPassword: string;
};

const DEFAULT_EMAIL_FORM: EmailFormState = {
  provider: "",
  senderName: "",
  email: "",
  smtpHost: "",
  smtpPort: "587",
  smtpUsername: "",
  smtpPassword: "",
};

export function SettingsPanel() {
  const [tier, setTier] = useState<"free" | "pro">("free");
  const [providerRefreshKey, setProviderRefreshKey] = useState(0);
  const [settings, setSettings] = useState({
    musicStation: "Lo-Fi",
    reducedMotion: false,
  });
  const [preferences, setPreferences] = useState({
    desiredTitles: [""] as string[],
    workModes: [] as string[],
    salaryTarget: "",
    locationPreference: "",
    industries: [""] as string[],
    values: [""] as string[],
    redFlags: [""] as string[],
    weeklyPace: "",
    defaultFollowUpDays: "7",
  });
  const [tagDrafts, setTagDrafts] = useState({
    desiredTitles: "",
    industries: "",
    values: "",
    redFlags: "",
  });
  const [tagEditing, setTagEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const [emailForm, setEmailForm] = useState<EmailFormState>(DEFAULT_EMAIL_FORM);
  const [emailNotice, setEmailNotice] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [activeEmailProvider, setActiveEmailProvider] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/user/tier").then(r => r.ok ? r.json() : null).then(d => { if (d?.tier) setTier(d.tier); }).catch(() => {});
    fetch("/api/settings").then(async (response) => {
      if (response.ok) {
        const body = await response.json();
        setSettings((current) => ({ ...current, ...body.settings }));
      }
    });
    fetch("/api/application-preferences").then(async (response) => {
      if (response.ok) {
        const body = await response.json();
        const desiredTitles = body.preferences.desiredTitles || [];
        const industries = body.preferences.industries || [];
        const values = body.preferences.values || [];
        const redFlags = body.preferences.redFlags || [];
        setPreferences({
          desiredTitles: desiredTitles.length ? desiredTitles : [""],
          workModes: body.preferences.workModes || [],
          salaryTarget: body.preferences.salaryTarget ? String(body.preferences.salaryTarget) : "",
          locationPreference: body.preferences.locationPreference || "",
          industries: industries.length ? industries : [""],
          values: values.length ? values : [""],
          redFlags: redFlags.length ? redFlags : [""],
          weeklyPace: body.preferences.weeklyPace ? String(body.preferences.weeklyPace) : "",
          defaultFollowUpDays: String(body.preferences.defaultFollowUpDays || 7),
        });
        setTagDrafts({
          desiredTitles: commaJoin(desiredTitles),
          industries: commaJoin(industries),
          values: commaJoin(values),
          redFlags: commaJoin(redFlags),
        });
      }
    });
    fetch("/api/email-connections").then(async (response) => {
      if (response.ok) {
        const body = await response.json();
        const active = (body.connections as Array<{ provider: string; email: string; senderName: string | null; active: boolean }>)
          .find((c) => c.active);
        if (active) {
          setActiveEmailProvider(active.provider);
          setEmailForm((f) => ({
            ...f,
            provider: active.provider as EmailProvider,
            email: active.email,
            senderName: active.senderName ?? "",
          }));
        }
      }
    });
  }, []);

  async function saveEmail(event: FormEvent) {
    event.preventDefault();
    if (!emailForm.provider) {
      setEmailNotice("Please select an email provider.");
      return;
    }
    setEmailSaving(true);
    setEmailNotice("");
    const preset =
      emailForm.provider !== "smtp"
        ? EMAIL_PROVIDER_PRESETS[emailForm.provider as Exclude<EmailProvider, "smtp" | "">]
        : null;
    const body: Record<string, unknown> = {
      provider: emailForm.provider,
      email: emailForm.email,
      senderName: emailForm.senderName || undefined,
      smtpHost: emailForm.smtpHost || preset?.smtpHost || undefined,
      smtpPort: emailForm.smtpPort ? Number(emailForm.smtpPort) : preset?.smtpPort || undefined,
      smtpUsername: emailForm.smtpUsername || emailForm.email || undefined,
      smtpPassword: emailForm.smtpPassword || undefined,
    };
    const response = await fetch("/api/email-connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) {
      setActiveEmailProvider(emailForm.provider);
      setEmailNotice("Email settings saved.");
      setEmailForm((f) => ({ ...f, smtpPassword: "" }));
    } else {
      const data = await response.json().catch(() => ({}));
      setEmailNotice(data.error ? String(data.error) : "Could not save email settings.");
    }
    setEmailSaving(false);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setNotice(response.ok ? "Preferences saved." : "Sign in to save preferences.");
  }

  async function feedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const raw = Object.fromEntries(new FormData(form));
    const response = await fetch("/api/github/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(raw),
    });
    const body = await response.json();
    if (response.ok) {
      form.reset();
      setNotice(`Feedback published as GitHub issue #${body.number}.`);
    } else setNotice(body.error || "Feedback could not be published.");
  }

  async function savePreferences(event: FormEvent) {
    event.preventDefault();
    const desiredTitles = parseCommaList(tagDrafts.desiredTitles);
    const industries = parseCommaList(tagDrafts.industries);
    const values = parseCommaList(tagDrafts.values);
    const redFlags = parseCommaList(tagDrafts.redFlags);
    const response = await fetch("/api/application-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        desiredTitles,
        workModes: preferences.workModes,
        salaryTarget: preferences.salaryTarget ? Number(preferences.salaryTarget) : null,
        locationPreference: preferences.locationPreference || null,
        industries,
        values,
        redFlags,
        weeklyPace: preferences.weeklyPace ? Number(preferences.weeklyPace) : null,
        defaultFollowUpDays: Number(preferences.defaultFollowUpDays || 7),
      }),
    });
    if (response.ok) {
      setPreferences((current) => ({ ...current, desiredTitles, industries, values, redFlags }));
      setTagEditing(false);
      setNotice("Tracker preferences saved.");
    } else {
      setNotice("Tracker preferences could not be saved.");
    }
  }

  function beginEditingTags() {
    setTagDrafts({
      desiredTitles: commaJoin(preferences.desiredTitles),
      industries: commaJoin(preferences.industries),
      values: commaJoin(preferences.values),
      redFlags: commaJoin(preferences.redFlags),
    });
    setTagEditing(true);
  }

  function cancelEditingTags() {
    setTagEditing(false);
  }

  return (
    <AppShell>
      <PageHeading
        eyebrow="Settings"
        title="Tune your workspace."
        copy="Connect AI providers, choose from models available to your keys, and adjust the atmosphere."
      />
      <div className="mt-7 grid items-start gap-6 lg:grid-cols-2">
        {tier === "pro" && <>
          <ProviderConnections onConnectionsChanged={() => setProviderRefreshKey((value) => value + 1)} />
          <DefaultAISelector refreshKey={providerRefreshKey} />
        </>}
        <form
          onSubmit={save}
          className="h-fit rounded-3xl border-2 border-ink bg-white p-6 shadow-[0_5px_0_#26312c]"
        >
          <h2 className="flex items-center gap-2 font-[var(--font-display)] text-xl font-black">
            <Headphones /> Atmosphere
          </h2>
          <label className="mt-4 block text-xs font-black uppercase tracking-wider text-plum">
            Default station
            <select
              value={settings.musicStation}
              onChange={(event) =>
                setSettings({ ...settings, musicStation: event.target.value })
              }
              className="mt-1 w-full rounded-2xl border-2 border-ink/15 px-3 py-3 text-sm normal-case"
            >
              {["Lo-Fi", "Ambient", "Classical", "Brain Waves"].map((station) => (
                <option key={station}>{station}</option>
              ))}
            </select>
          </label>
          <label className="mt-4 flex gap-3 rounded-2xl bg-cream p-3 text-sm font-bold">
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={(event) =>
                setSettings({ ...settings, reducedMotion: event.target.checked })
              }
              className="size-4 accent-coral"
            />
            Prefer gentler motion
          </label>
          <button className="mt-5 flex w-full justify-center gap-2 rounded-2xl border-2 border-ink bg-mint py-3 font-black shadow-[0_4px_0_#26312c]">
            <CheckCircle2 /> Save preferences
          </button>
        </form>
        <form onSubmit={savePreferences} className="rounded-3xl border-2 border-ink bg-white p-6 shadow-[0_5px_0_#26312c]">
          <h2 className="font-[var(--font-display)] text-xl font-black">Tracker preferences</h2>
          <p className="mt-2 text-sm text-ink/55">These guide Career DJ, follow-up timing, and offer comparisons.</p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-wider text-ink/55">
              {tagEditing ? "Separate each value with a comma" : "Tag lists"}
            </p>
            {!tagEditing ? (
              <button type="button" onClick={beginEditingTags} className="text-xs font-black underline decoration-coral decoration-2 underline-offset-4">
                Edit tags
              </button>
            ) : (
              <button type="button" onClick={cancelEditingTags} className="text-xs font-black underline decoration-coral decoration-2 underline-offset-4">
                Cancel
              </button>
            )}
          </div>
          <TagField
            label="Desired titles"
            editing={tagEditing}
            draft={tagDrafts.desiredTitles}
            values={preferences.desiredTitles}
            onChange={(desiredTitles) => setTagDrafts({ ...tagDrafts, desiredTitles })}
          />
          <TagField
            label="Industries"
            editing={tagEditing}
            draft={tagDrafts.industries}
            values={preferences.industries}
            onChange={(industries) => setTagDrafts({ ...tagDrafts, industries })}
          />
          <TagField
            label="Values"
            editing={tagEditing}
            draft={tagDrafts.values}
            values={preferences.values}
            onChange={(values) => setTagDrafts({ ...tagDrafts, values })}
          />
          <TagField
            label="Red flags"
            editing={tagEditing}
            draft={tagDrafts.redFlags}
            values={preferences.redFlags}
            onChange={(redFlags) => setTagDrafts({ ...tagDrafts, redFlags })}
          />
          <label className="mt-4 block text-xs font-black uppercase tracking-wider text-plum">
            Work modes
            <div className="mt-2 flex flex-wrap gap-2">
              {["remote", "hybrid", "onsite", "flexible"].map((mode) => <button type="button" key={mode} onClick={() => setPreferences((current) => ({ ...current, workModes: current.workModes.includes(mode) ? current.workModes.filter((item) => item !== mode) : [...current.workModes, mode] }))} className={`rounded-full px-3 py-1.5 text-xs font-black ${preferences.workModes.includes(mode) ? "bg-sun" : "bg-cream"}`}>{mode}</button>)}
            </div>
          </label>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input label="Salary target" value={preferences.salaryTarget} onChange={(salaryTarget) => setPreferences({ ...preferences, salaryTarget })} />
            <Input label="Location preference" value={preferences.locationPreference} onChange={(locationPreference) => setPreferences({ ...preferences, locationPreference })} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input label="Weekly pace" value={preferences.weeklyPace} onChange={(weeklyPace) => setPreferences({ ...preferences, weeklyPace })} />
            <Input label="Default follow-up days" value={preferences.defaultFollowUpDays} onChange={(defaultFollowUpDays) => setPreferences({ ...preferences, defaultFollowUpDays })} />
          </div>
          <button className="mt-5 flex w-full justify-center gap-2 rounded-2xl border-2 border-ink bg-sun py-3 font-black shadow-[0_4px_0_#26312c]">
            <CheckCircle2 /> Save tracker preferences
          </button>
        </form>
        <div className="space-y-6">
          <form onSubmit={feedback} className="rounded-3xl border-2 border-ink bg-sun/30 p-6">
            <h2 className="flex items-center gap-2 font-[var(--font-display)] text-xl font-black">
              <Github /> Shape CareerGroove
            </h2>
            <p className="mt-2 text-sm text-ink/55">
              Send feedback directly into the connected GitHub project.
            </p>
            <label className="mt-4 block text-xs font-black uppercase tracking-wider text-plum">
              Title
              <input name="title" required minLength={3} className="mt-1 w-full rounded-2xl border-2 border-ink/15 px-3 py-3 text-sm font-bold normal-case" />
            </label>
            <label className="mt-4 block text-xs font-black uppercase tracking-wider text-plum">
              Details
              <textarea name="body" required minLength={3} className="mt-1 min-h-32 w-full rounded-2xl border-2 border-ink/15 p-3 text-sm font-normal normal-case" />
            </label>
            <button className="mt-4 flex w-full justify-center gap-2 rounded-2xl border-2 border-ink bg-coral py-3 font-black shadow-[0_4px_0_#26312c]">
              <Send /> Send feedback
            </button>
          </form>
          <div className="rounded-3xl border-2 border-ink/15 bg-white/60 p-5">
            <ShieldCheck />
            <h3 className="mt-3 font-black">Your keys stay private</h3>
            <p className="mt-1 text-sm text-ink/55">
              API keys are encrypted with AES-256-GCM before storage and are only decrypted server-side when calling the selected provider.
            </p>
          </div>
          {notice && <p role="status" className="rounded-2xl bg-mint/30 p-4 text-sm font-bold">{notice}</p>}
        </div>
      </div>
      <EmailSettingsCard
        form={emailForm}
        activeProvider={activeEmailProvider}
        saving={emailSaving}
        notice={emailNotice}
        onChange={setEmailForm}
        onSubmit={saveEmail}
      />
    </AppShell>
  );
}

function commaJoin(values: string[]) {
  return values.filter((value) => value.trim()).join(", ");
}

function parseCommaList(text: string) {
  return Array.from(new Set(text.split(",").map((value) => value.trim()).filter(Boolean)));
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-xs font-black uppercase tracking-wider text-plum">
    {label}
    <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-2xl border-2 border-ink/15 px-3 py-3 text-sm font-bold normal-case" />
  </label>;
}

function TagField({ label, editing, draft, values, onChange }: {
  label: string; editing: boolean; draft: string; values: string[]; onChange: (text: string) => void;
}) {
  if (editing) {
    return (
      <label className="mt-4 block text-xs font-black uppercase tracking-wider text-plum">
        {label}
        <textarea
          value={draft}
          onChange={(event) => onChange(event.target.value)}
          rows={Math.max(2, Math.min(5, draft.split(",").length + 1))}
          placeholder="Separate with commas, e.g. React, TypeScript, Node"
          className="mt-1 min-h-16 w-full resize-y rounded-2xl border-2 border-ink/15 px-3 py-3 text-sm font-bold normal-case"
        />
      </label>
    );
  }
  const tags = values.filter((value) => value.trim());
  return (
    <div className="mt-4">
      <p className="text-xs font-black uppercase tracking-wider text-plum">{label}</p>
      {tags.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full bg-cream px-3 py-1.5 text-xs font-black">{tag}</span>
          ))}
        </div>
      ) : (
        <p className="mt-2 rounded-2xl border-2 border-dashed border-ink/15 bg-white/60 px-3 py-3 text-sm font-bold text-ink/45">Nothing set yet.</p>
      )}
    </div>
  );
}

function EmailSettingsCard({
  form,
  activeProvider,
  saving,
  notice,
  onChange,
  onSubmit,
}: {
  form: EmailFormState;
  activeProvider: string | null;
  saving: boolean;
  notice: string;
  onChange: (f: EmailFormState) => void;
  onSubmit: (e: FormEvent) => void;
}) {
  const preset =
    form.provider && form.provider !== "smtp"
      ? EMAIL_PROVIDER_PRESETS[form.provider as Exclude<EmailProvider, "smtp" | "">]
      : null;

  function handleProviderChange(provider: EmailProvider) {
    const p = provider !== "smtp" && provider !== "" ? EMAIL_PROVIDER_PRESETS[provider as Exclude<EmailProvider, "smtp" | "">] : null;
    onChange({
      ...form,
      provider,
      smtpHost: p?.smtpHost ?? "",
      smtpPort: p ? String(p.smtpPort) : "587",
    });
  }

  return (
    <div className="mt-6">
      <form
        onSubmit={onSubmit}
        className="rounded-3xl border-2 border-ink bg-white p-6 shadow-[0_5px_0_#26312c] lg:max-w-xl"
      >
        <h2 className="flex items-center gap-2 font-[var(--font-display)] text-xl font-black">
          <Mail /> Email settings
        </h2>
        <p className="mt-1 text-sm text-ink/55">
          Used to send follow-up emails directly from CareerGroove.
          {activeProvider && (
            <span className="ml-2 rounded-full bg-mint/30 px-2 py-0.5 text-xs font-black capitalize text-ink">
              {activeProvider} connected
            </span>
          )}
        </p>

        <label className="mt-5 block text-xs font-black uppercase tracking-wider text-plum">
          Email provider
          <select
            value={form.provider}
            onChange={(e) => handleProviderChange(e.target.value as EmailProvider)}
            className="mt-1 w-full rounded-2xl border-2 border-ink/15 px-3 py-3 text-sm normal-case"
            required
          >
            <option value="">— Select a provider —</option>
            <option value="gmail">Gmail</option>
            <option value="icloud">iCloud</option>
            <option value="yahoo">Yahoo</option>
            <option value="outlook">Outlook</option>
            <option value="smtp">Other (custom SMTP)</option>
          </select>
        </label>

        {preset && (
          <div className="mt-3 rounded-2xl bg-cream p-4 text-xs leading-5 text-ink/70">
            <p className="font-black text-ink">How to get your app password</p>
            <p className="mt-1">{preset.note}</p>
          </div>
        )}

        <label className="mt-4 block text-xs font-black uppercase tracking-wider text-plum">
          Your name (shown in From:)
          <input
            value={form.senderName}
            onChange={(e) => onChange({ ...form, senderName: e.target.value })}
            placeholder="Jane Smith"
            className="mt-1 w-full rounded-2xl border-2 border-ink/15 px-3 py-3 text-sm font-bold normal-case"
          />
        </label>

        <label className="mt-4 block text-xs font-black uppercase tracking-wider text-plum">
          Email address
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => onChange({ ...form, email: e.target.value })}
            placeholder="you@example.com"
            className="mt-1 w-full rounded-2xl border-2 border-ink/15 px-3 py-3 text-sm font-bold normal-case"
          />
        </label>

        {form.provider === "smtp" && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-black uppercase tracking-wider text-plum">
              SMTP host
              <input
                value={form.smtpHost}
                onChange={(e) => onChange({ ...form, smtpHost: e.target.value })}
                placeholder="smtp.example.com"
                className="mt-1 w-full rounded-2xl border-2 border-ink/15 px-3 py-3 text-sm font-bold normal-case"
              />
            </label>
            <label className="block text-xs font-black uppercase tracking-wider text-plum">
              SMTP port
              <input
                type="number"
                value={form.smtpPort}
                onChange={(e) => onChange({ ...form, smtpPort: e.target.value })}
                placeholder="587"
                className="mt-1 w-full rounded-2xl border-2 border-ink/15 px-3 py-3 text-sm font-bold normal-case"
              />
            </label>
          </div>
        )}

        <label className="mt-4 block text-xs font-black uppercase tracking-wider text-plum">
          {preset ? "App password" : "Password"}
          <input
            type="password"
            value={form.smtpPassword}
            onChange={(e) => onChange({ ...form, smtpPassword: e.target.value })}
            placeholder={activeProvider ? "Leave blank to keep existing password" : ""}
            className="mt-1 w-full rounded-2xl border-2 border-ink/15 px-3 py-3 text-sm font-bold normal-case"
          />
        </label>

        <button
          type="submit"
          disabled={saving}
          className="mt-5 flex w-full justify-center gap-2 rounded-2xl border-2 border-ink bg-plum py-3 font-black text-white shadow-[0_4px_0_#26312c] disabled:opacity-60"
        >
          <CheckCircle2 size={18} />
          {saving ? "Saving…" : "Save email settings"}
        </button>

        {notice && (
          <p role="status" className="mt-3 rounded-2xl bg-mint/30 p-3 text-sm font-bold">
            {notice}
          </p>
        )}
      </form>
    </div>
  );
}
