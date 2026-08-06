import type { PoolClient } from "pg";

import { commandSessionActions, type CommandSessionAction } from "@/lib/application-schema";

export type ApplicationRow = {
  id: string;
  status: string;
  title: string;
  company: string;
  location: string | null;
  workMode: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  description: string;
  notes: string | null;
  sourceUrl: string | null;
  priorityLabel: string | null;
  nextActionType: string | null;
  nextActionReason: string | null;
  followUpDueAt: string | Date | null;
  appliedAt: string | Date | null;
  createdAt: string | Date;
  metadata: Record<string, unknown> | null;
};

export type TrackerContext = {
  profile: { name: string | null; phone: string | null };
  preferences: {
    desiredTitles: string[];
    workModes: string[];
    salaryTarget: number | null;
    locationPreference: string | null;
    industries: string[];
    values: string[];
    redFlags: string[];
    defaultFollowUpDays: number;
  };
  jobs: Array<{ title: string; company: string; rawNotes: string | null; achievements: string[] }>;
  skills: string[];
  contacts: Array<{ company: string | null; role: string | null; name: string }>;
  linkedDocuments: number;
};

type ScoreResult = {
  fit: number;
  readiness: number;
  desire: number;
  leverage: number;
  risk: number;
  timing: number;
  label: string;
  reasons: string[];
  gaps: string[];
  nextAction: CommandSessionAction;
  nextActionReason: string;
  contextSnapshot: Record<string, unknown>;
};

export type TrackerReadiness = {
  score: number;
  ready: boolean;
  headline: string;
  message: string;
  checklist: Array<{ label: string; done: boolean }>;
};

export type CommandSessionSummary = {
  mode: "light" | "standard" | "deep" | "recovery" | "interview";
  title: string;
  intro: string;
  actions: Array<{
    actionType: CommandSessionAction;
    title: string;
    reason: string;
    routeTarget: string;
    applicationId: string | null;
  }>;
};

const tokenSplit = /[^a-z0-9+#./-]+/i;
const actionLabels: Record<CommandSessionAction, string> = {
  capture_job: "Capture a job",
  research_company: "Research the company",
  remix_resume: "Remix your resume",
  draft_cover_letter: "Draft a cover letter",
  answer_questions: "Answer application questions",
  apply: "Apply now",
  follow_up: "Send a follow-up",
  contact_referral: "Reach out to a contact",
  prep_interview: "Prep the interview",
  log_outcome: "Log the outcome",
  review_rejection: "Review the rejection gently",
  compare_offer: "Compare the offer",
  archive_role: "Archive the role",
};

const suspiciousTerms = ["urgent hiring", "easy money", "commission only", "1099 only", "unpaid", "crypto", "telegram", "whatsapp"];

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").toLowerCase();
}

function tokenize(value: string | null | undefined) {
  return normalizeText(value)
    .split(tokenSplit)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function daysBetween(left: Date, right: Date) {
  return Math.round((left.getTime() - right.getTime()) / 86400000);
}

function scoreLabelToAction(label: string): CommandSessionAction {
  switch (label) {
    case "apply_first":
      return "apply";
    case "research_before_applying":
    case "low_signal_lead":
      return "research_company";
    case "remix_resume_first":
    case "stretch_role":
      return "remix_resume";
    case "network_first":
      return "contact_referral";
    case "follow_up_now":
      return "follow_up";
    case "prep_mode":
      return "prep_interview";
    default:
      return "archive_role";
  }
}

function scoreLabelReason(label: string): string {
  switch (label) {
    case "apply_first":
      return "This role looks worth attention now.";
    case "research_before_applying":
      return "Learn one concrete thing before spending document time.";
    case "remix_resume_first":
      return "Tune your resume toward this role before applying.";
    case "network_first":
      return "A person may improve the odds here.";
    case "stretch_role":
      return "Close the biggest evidence gap before you spend more effort.";
    case "low_signal_lead":
      return "Get more signal before committing your energy.";
    case "probably_skip":
      return "This may not repay the attention it asks for.";
    case "follow_up_now":
      return "The timing is right for a concise follow-up.";
    case "prep_mode":
      return "Use this role for focused prep and follow-through.";
    default:
      return "Choose the next step that feels most realistic today.";
  }
}

function routeFor(applicationId: string, section?: string) {
  return `/applications?applicationId=${applicationId}${section ? `#application-section-${section}` : ""}`;
}

export function buildTrackerReadiness(context: TrackerContext): TrackerReadiness {
  const checklist = [
    { label: "Profile has your name and phone", done: Boolean(context.profile.name && context.profile.phone) },
    { label: "Journey has at least one work chapter", done: context.jobs.length > 0 },
    { label: "Skills library has something to match against", done: context.skills.length > 0 },
    { label: "Preferences are set for target roles or work style", done: context.preferences.desiredTitles.length > 0 || context.preferences.workModes.length > 0 || Boolean(context.preferences.locationPreference) },
  ];
  const score = clamp((checklist.filter((item) => item.done).length / checklist.length) * 100);
  if (score >= 75) {
    return {
      score,
      ready: true,
      headline: "Your story is ready enough to start tracking applications.",
      message: "You can keep improving details over time, but CareerGroove already has enough context to guide your next move.",
      checklist,
    };
  }
  return {
    score,
    ready: false,
    headline: "Your tracker can still help, but one more ingredient would sharpen it.",
    message: context.jobs.length === 0
      ? "Add one recent work chapter so CareerGroove can tailor your documents and prep."
      : context.skills.length === 0
        ? "Add or infer a few skills so saved roles can be matched more clearly."
        : "Fill in one missing piece and the recommendations will get stronger.",
    checklist,
  };
}

export function computeScore(application: ApplicationRow, context: TrackerContext): ScoreResult {
  const now = new Date();
  const description = normalizeText(application.description);
  const title = normalizeText(application.title);
  const company = normalizeText(application.company);
  const location = normalizeText(application.location);
  const notes = normalizeText(application.notes);
  const applicationTokens = unique([
    ...tokenize(application.title),
    ...tokenize(application.description),
    ...tokenize(application.notes),
  ]);
  const skillMatches = context.skills.filter((skill) => {
    const normalized = normalizeText(skill);
    if (applicationTokens.includes(normalized)) return true;
    const tokens = tokenize(skill);
    return tokens.length > 1 && tokens.every((t) => applicationTokens.includes(t));
  });
  const preferredTitleMatches = context.preferences.desiredTitles.filter((preferred) => {
    const tokens = tokenize(preferred);
    return tokens.length > 0 && tokens.every((token) => title.includes(token));
  });
  const jobTitleMatches = context.jobs.filter((job) => tokenize(job.title).some((token) => title.includes(token)));
  const companyContacts = context.contacts.filter((contact) => normalizeText(contact.company) === company);
  const referralHints = ["referral", "recruiter", "hiring manager", "alumni", "network"];
  const hasReferralHint = referralHints.some((hint) => description.includes(hint) || notes.includes(hint));
  const wantsWorkMode = context.preferences.workModes.length > 0;
  const workModeMatch = wantsWorkMode && application.workMode ? context.preferences.workModes.includes(application.workMode) : false;
  const locationMatch = context.preferences.locationPreference
    ? location.includes(normalizeText(context.preferences.locationPreference))
    : false;
  const salaryTarget = context.preferences.salaryTarget ?? null;
  const salaryMeetsTarget = salaryTarget !== null
    ? (application.salaryMax ?? application.salaryMin ?? 0) >= salaryTarget
    : null;
  const createdAt = new Date(application.createdAt);
  const followUpDueAt = application.followUpDueAt ? new Date(application.followUpDueAt) : null;
  const appliedAt = application.appliedAt ? new Date(application.appliedAt) : null;

  let fit = 30;
  fit += Math.min(skillMatches.length, 6) * 8;
  fit += Math.min(preferredTitleMatches.length, 2) * 14;
  fit += Math.min(jobTitleMatches.length, 2) * 10;
  if (description.includes("years") || description.includes("experience")) fit += 5;
  if (description.length < 180) fit -= 12;

  let readiness = 25;
  if (context.jobs.length > 0) readiness += 20;
  if (context.skills.length > 0) readiness += 12;
  if (context.profile.name) readiness += 8;
  if (context.profile.phone) readiness += 8;
  if (context.linkedDocuments > 0) readiness += 10;
  if (application.sourceUrl) readiness += 5;
  if (application.notes) readiness += 4;
  if (application.status === "ready_to_apply") readiness += 12;
  if (application.status === "applied") readiness += 18;
  if (application.status === "interviewing" || application.status === "offer") readiness += 24;

  let desire = 40;
  if (preferredTitleMatches.length > 0) desire += 20;
  if (workModeMatch) desire += 12;
  if (locationMatch) desire += 10;
  if (salaryMeetsTarget === true) desire += 14;
  if (salaryMeetsTarget === false) desire -= 12;
  for (const industry of context.preferences.industries) {
    if (description.includes(industry.toLowerCase()) || company.includes(industry.toLowerCase())) desire += 5;
  }
  for (const value of context.preferences.values) {
    if (description.includes(value.toLowerCase())) desire += 4;
  }

  let leverage = 18;
  leverage += Math.min(companyContacts.length, 2) * 18;
  if (hasReferralHint) leverage += 14;
  if (context.contacts.length >= 10) leverage += 6;
  if (context.jobs.some((job) => normalizeText(job.company) === company)) leverage += 12;

  let risk = 28;
  if (description.length < 180) risk += 22;
  if (!application.salaryMin && !application.salaryMax && salaryTarget !== null) risk += 8;
  if (salaryMeetsTarget === false) risk += 14;
  if (!workModeMatch && wantsWorkMode && application.workMode) risk += 7;
  if (application.status === "saved" && !application.sourceUrl) risk += 6;
  if (skillMatches.length === 0) risk += 14;
  if (context.preferences.redFlags.some((flag) => description.includes(flag.toLowerCase()))) risk += 15;
  if (suspiciousTerms.some((term) => description.includes(term))) risk += 20;

  let timing = 45;
  const ageDays = Math.max(0, daysBetween(now, createdAt));
  if (ageDays <= 3) timing += 15;
  if (ageDays >= 21) timing -= 18;
  if (application.status === "applied" && appliedAt) {
    const appliedDays = Math.max(0, daysBetween(now, appliedAt));
    timing = appliedDays >= context.preferences.defaultFollowUpDays ? 88 : 62;
  }
  if (followUpDueAt) {
    const daysUntilFollowUp = daysBetween(followUpDueAt, now);
    if (daysUntilFollowUp <= 0) timing = 92;
    else if (daysUntilFollowUp <= 2) timing = 78;
  }
  if (application.status === "interviewing") timing = 90;
  if (application.status === "offer") timing = 97;
  if (application.status === "rejected" || application.status === "withdrawn" || application.status === "archived") timing = 25;

  fit = clamp(fit);
  readiness = clamp(readiness);
  desire = clamp(desire);
  leverage = clamp(leverage);
  risk = clamp(risk);
  timing = clamp(timing);

  const reasons: string[] = [];
  const gaps: string[] = [];
  if (skillMatches.length > 0) reasons.push(`Matched ${Math.min(skillMatches.length, 6)} saved skill${skillMatches.length === 1 ? "" : "s"} from your Journey.`);
  if (preferredTitleMatches.length > 0) reasons.push("The title lines up with roles you said you want.");
  if (companyContacts.length > 0) reasons.push(`You already know ${companyContacts[0].name} at this company.`);
  if (workModeMatch) reasons.push("The work mode fits your saved preference.");
  if (salaryMeetsTarget === true) reasons.push("The pay range clears your current target.");
  if (application.status === "interviewing") reasons.push("This role is already in interview motion.");
  if (application.status === "offer") reasons.push("This role needs decision clarity more than new research.");

  if (skillMatches.length === 0) gaps.push("No saved skill evidence matched this description yet.");
  if (context.jobs.length === 0) gaps.push("Add one work chapter so tailoring has stronger material.");
  if (!application.sourceUrl) gaps.push("Save the original posting link so you can revisit details fast.");
  if (description.length < 180) gaps.push("The posting is thin, so it needs more research before document work.");
  if (salaryMeetsTarget === false) gaps.push("The posted pay looks below your target.");
  if (!companyContacts.length && hasReferralHint) gaps.push("The posting hints that outreach could matter, but no linked contact is saved.");

  let label = "research_before_applying";
  if (application.status === "interviewing" || application.status === "offer") {
    label = "prep_mode";
  } else if ((application.status === "applied" || application.status === "follow_up") && timing >= 85) {
    label = "follow_up_now";
  } else if (risk >= 72 && fit <= 50) {
    label = "probably_skip";
  } else if (companyContacts.length > 0 || (hasReferralHint && leverage >= 45)) {
    label = "network_first";
  } else if (fit >= 70 && readiness >= 65 && risk <= 45) {
    label = "apply_first";
  } else if (fit >= 60 && readiness < 65) {
    label = "remix_resume_first";
  } else if (fit >= 52 && risk >= 55) {
    label = "stretch_role";
  } else if (description.length < 180 || risk >= 60) {
    label = "low_signal_lead";
  }

  const nextAction = scoreLabelToAction(label);
  return {
    fit,
    readiness,
    desire,
    leverage,
    risk,
    timing,
    label,
    reasons: reasons.slice(0, 4),
    gaps: unique(gaps).slice(0, 4),
    nextAction,
    nextActionReason: scoreLabelReason(label),
    contextSnapshot: {
      matchedSkills: skillMatches.slice(0, 8),
      preferredTitleMatches,
      companyContactCount: companyContacts.length,
      readinessSignals: {
        jobs: context.jobs.length,
        skills: context.skills.length,
        documents: context.linkedDocuments,
      },
    },
  };
}

export async function loadTrackerContext(client: PoolClient, userId: string): Promise<TrackerContext> {
  const [profileResult, preferencesResult, jobsResult, skillsResult, contactsResult, docsResult] = await Promise.all([
    client.query(`SELECT name,COALESCE(preferences->>'phone','') AS phone FROM users WHERE id=$1`, [userId]),
    client.query(
      `SELECT desired_titles AS "desiredTitles",work_modes AS "workModes",salary_target AS "salaryTarget",
        location_preference AS "locationPreference",industries,"values",red_flags AS "redFlags",
        default_follow_up_days AS "defaultFollowUpDays"
       FROM user_job_preferences WHERE user_id=$1`,
      [userId],
    ),
    client.query(
      `SELECT title,company,raw_notes AS "rawNotes",achievements
       FROM jobs WHERE user_id=$1
       ORDER BY current DESC,ended_on DESC NULLS LAST,started_on DESC NULLS LAST,created_at DESC
       LIMIT 8`,
      [userId],
    ),
    client.query(`SELECT name FROM skills WHERE user_id=$1 ORDER BY proficiency DESC,name LIMIT 60`, [userId]),
    client.query(`SELECT name,company,role FROM contacts WHERE user_id=$1 ORDER BY relationship_strength DESC,name LIMIT 40`, [userId]),
    client.query(`SELECT count(*)::int AS count FROM application_documents WHERE user_id=$1 AND status <> 'archived'`, [userId]),
  ]);

  return {
    profile: {
      name: profileResult.rows[0]?.name ?? null,
      phone: profileResult.rows[0]?.phone ?? null,
    },
    preferences: {
      desiredTitles: preferencesResult.rows[0]?.desiredTitles ?? [],
      workModes: preferencesResult.rows[0]?.workModes ?? [],
      salaryTarget: preferencesResult.rows[0]?.salaryTarget ?? null,
      locationPreference: preferencesResult.rows[0]?.locationPreference ?? null,
      industries: preferencesResult.rows[0]?.industries ?? [],
      values: preferencesResult.rows[0]?.values ?? [],
      redFlags: preferencesResult.rows[0]?.redFlags ?? [],
      defaultFollowUpDays: preferencesResult.rows[0]?.defaultFollowUpDays ?? 7,
    },
    jobs: jobsResult.rows,
    skills: skillsResult.rows.map((row) => row.name as string),
    contacts: contactsResult.rows,
    linkedDocuments: docsResult.rows[0]?.count ?? 0,
  };
}

export const stepFromStatus: Record<string, number> = {
  saved: 1, researching: 1, ready_to_apply: 2,
  applied: 3, follow_up: 3, interviewing: 4,
  offer: 5, rejected: 6, withdrawn: 6, archived: 6,
};

export async function refreshApplicationScore(client: PoolClient, userId: string, applicationId: string) {
  const applicationResult = await client.query(
    `SELECT id,status,title,company,location,work_mode AS "workMode",
      salary_min AS "salaryMin",salary_max AS "salaryMax",description,notes,source_url AS "sourceUrl",
      priority_label AS "priorityLabel",next_action_type AS "nextActionType",next_action_reason AS "nextActionReason",
      follow_up_due_at AS "followUpDueAt",applied_at AS "appliedAt",metadata,created_at AS "createdAt"
     FROM applications WHERE id=$1 AND user_id=$2`,
    [applicationId, userId],
  );
  if (!applicationResult.rowCount) return null;

  const context = await loadTrackerContext(client, userId);
  const readiness = buildTrackerReadiness(context);
  const score = computeScore(applicationResult.rows[0], context);
  const currentStep = stepFromStatus[applicationResult.rows[0].status] ?? 1;
  const inserted = await client.query(
    `INSERT INTO application_scores(user_id,application_id,fit,readiness,desire,leverage,risk,timing,label,reasons,gaps,next_action,context_snapshot)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13::jsonb)
     RETURNING id,label,fit,readiness,desire,leverage,risk,timing,reasons,gaps,next_action AS "nextAction",created_at AS "createdAt"`,
    [
      userId,
      applicationId,
      score.fit,
      score.readiness,
      score.desire,
      score.leverage,
      score.risk,
      score.timing,
      score.label,
      JSON.stringify(score.reasons),
      JSON.stringify(score.gaps),
      score.nextAction,
      JSON.stringify({
        ...score.contextSnapshot,
        trackerReadiness: readiness.score,
      }),
    ],
  );
  await client.query(
    `UPDATE applications
     SET priority_label=$3,next_action_type=$4,next_action_reason=$5,
       current_step=GREATEST(COALESCE(current_step,0),$6),updated_at=now()
     WHERE id=$1 AND user_id=$2`,
    [applicationId, userId, score.label, score.nextAction, score.nextActionReason, currentStep],
  );
  return {
    latestScore: {
      ...inserted.rows[0],
      reasons: score.reasons,
      gaps: score.gaps,
    },
    nextActionType: score.nextAction,
    nextActionReason: score.nextActionReason,
    priorityLabel: score.label,
    currentStep,
    trackerReadiness: readiness,
  };
}

export function buildCommandSession(mode: CommandSessionSummary["mode"], applications: ApplicationRow[], readiness: TrackerReadiness): CommandSessionSummary {
  const now = new Date();
  const ordered = [...applications].sort((left, right) => {
    const leftDue = left.followUpDueAt ? new Date(left.followUpDueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const rightDue = right.followUpDueAt ? new Date(right.followUpDueAt).getTime() : Number.MAX_SAFE_INTEGER;
    return leftDue - rightDue;
  });
  const actions: CommandSessionSummary["actions"] = [];
  const pushAction = (action: CommandSessionSummary["actions"][number]) => {
    if (actions.length >= 5) return;
    if (!commandSessionActions.includes(action.actionType)) return;
    if (action.applicationId && actions.some((item) => item.applicationId === action.applicationId && item.actionType === action.actionType)) return;
    actions.push(action);
  };

  const offerDeadline = (application: ApplicationRow) => {
    const offer = application.metadata?.offer;
    if (!offer || typeof offer !== "object") return null;
    const value = (offer as Record<string, unknown>).decisionDeadline;
    return typeof value === "string" && value ? new Date(value) : null;
  };
  const daysUntil = (date: Date) => Math.ceil((date.getTime() - now.getTime()) / 86400000);
  const offers = ordered
    .filter((application) => application.status === "offer")
    .sort((left, right) => {
      const leftDeadline = offerDeadline(left)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightDeadline = offerDeadline(right)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return leftDeadline - rightDeadline;
    });
  const followUps = ordered.filter((application) => application.status === "follow_up" || application.status === "applied").filter((application) => {
    if (!application.followUpDueAt) return application.status === "applied";
    return new Date(application.followUpDueAt) <= now;
  });
  const interviews = ordered.filter((application) => application.status === "interviewing");
  const remixRoles = ordered.filter((application) => application.priorityLabel === "remix_resume_first" || application.priorityLabel === "stretch_role");
  const networkRoles = ordered.filter((application) => application.priorityLabel === "network_first");
  const applyNow = ordered.filter((application) => application.priorityLabel === "apply_first" || application.status === "ready_to_apply");
  const researchRoles = ordered.filter((application) => application.priorityLabel === "research_before_applying" || application.priorityLabel === "low_signal_lead");
  const rejections = ordered.filter((application) => application.status === "rejected" || application.status === "withdrawn");

  for (const application of offers) {
    const deadline = offerDeadline(application);
    pushAction({
      actionType: "compare_offer",
      title: deadline && daysUntil(deadline) <= 3 ? "Review offer deadline" : actionLabels.compare_offer,
      reason: deadline && daysUntil(deadline) <= 3
        ? "The decision window is close. Keep this calm and concrete."
        : "Quiet the noise and focus on decision clarity.",
      routeTarget: routeFor(application.id, "offer"),
      applicationId: application.id,
    });
  }
  for (const application of interviews) {
    pushAction({
      actionType: "prep_interview",
      title: mode === "interview" ? "Soundcheck this interview" : actionLabels.prep_interview,
      reason: "This role is already active, so prep beats more browsing.",
      routeTarget: routeFor(application.id, "timeline"),
      applicationId: application.id,
    });
  }
  for (const application of followUps) {
    pushAction({
      actionType: "follow_up",
      title: actionLabels.follow_up,
      reason: "The timing is right for a nudge or a clear log entry.",
      routeTarget: routeFor(application.id, "timeline"),
      applicationId: application.id,
    });
  }
  for (const application of applyNow) {
    pushAction({
      actionType: "apply",
      title: actionLabels.apply,
      reason: "This looks like one of today's strongest opportunities.",
      routeTarget: routeFor(application.id, "submission"),
      applicationId: application.id,
    });
  }
  for (const application of remixRoles) {
    pushAction({
      actionType: "remix_resume",
      title: actionLabels.remix_resume,
      reason: "A tighter story should improve this role before you submit.",
      routeTarget: routeFor(application.id, "documents"),
      applicationId: application.id,
    });
  }
  for (const application of networkRoles) {
    pushAction({
      actionType: "contact_referral",
      title: actionLabels.contact_referral,
      reason: "This role looks stronger with a warm intro or recruiter note.",
      routeTarget: routeFor(application.id, "network"),
      applicationId: application.id,
    });
  }
  for (const application of researchRoles) {
    pushAction({
      actionType: "research_company",
      title: actionLabels.research_company,
      reason: "Get one more concrete signal before you spend document energy.",
      routeTarget: routeFor(application.id, "research"),
      applicationId: application.id,
    });
  }
  if (mode === "recovery" || actions.length < 2) {
    for (const application of rejections) {
      pushAction({
        actionType: "review_rejection",
        title: actionLabels.review_rejection,
        reason: "Optional, low-pressure pattern spotting. No blame, just signal.",
        routeTarget: routeFor(application.id, "rejection"),
        applicationId: application.id,
      });
    }
  }
  if (!actions.length || (mode === "recovery" && actions.length > 1)) {
    actions.splice(0, actions.length);
    if (!readiness.ready) {
      actions.push({
        actionType: "capture_job",
        title: "Tighten your setup",
        reason: readiness.message,
        routeTarget: "/journey",
        applicationId: null,
      });
    } else if (ordered[0]) {
      actions.push({
        actionType: "log_outcome",
        title: "Log one gentle update",
        reason: "A tiny update counts. Keep momentum without pressure.",
        routeTarget: routeFor(ordered[0].id, "outcome"),
        applicationId: ordered[0].id,
      });
    } else {
      actions.push({
        actionType: "capture_job",
        title: actionLabels.capture_job,
        reason: "Start by saving one role so the tracker has something to guide.",
        routeTarget: "/applications",
        applicationId: null,
      });
    }
  }

  const limits = { light: 2, standard: 3, deep: 5, recovery: 1, interview: 3 };
  const titleMap = {
    light: "Light Session",
    standard: "Today's Mix",
    deep: "Deep Session",
    recovery: "Recovery Session",
    interview: "Soundcheck Session",
  } as const;
  const introMap = {
    light: "A small, realistic setlist for today.",
    standard: "A balanced mix of momentum and follow-through.",
    deep: "A fuller session for when you have real focus to spend.",
    recovery: "Low-pressure next steps only.",
    interview: "Lead with the roles already in motion.",
  } as const;

  return {
    mode,
    title: titleMap[mode],
    intro: introMap[mode],
    actions: actions.slice(0, limits[mode]),
  };
}
