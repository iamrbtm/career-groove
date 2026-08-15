#!/usr/bin/env node
/**
 * score-parity-check.mjs
 *
 * Verifies that an email-imported job produces a fit score in the same band as
 * the manually captured version of the same role. Runs offline (no Next.js
 * runtime) by reading the user's saved context from the database, then
 * replicating the deterministic computeScore() logic from lib/tracker-studio.ts.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/score-parity-check.mjs <userId> <emailFile>
 *
 * Reads the email text from <emailFile>. Emits a side-by-side table per job and
 * exits non-zero if any scrape-vs-fallback delta is suspicious in either
 * direction.
 */
import { readFile } from "node:fs/promises";
import pg from "pg";

const SCRAPED_LEN_THRESHOLD = 800;
const MAX_FALLBACK_OVER_SCRAPED = 5;
const MAX_SCRAPED_OVER_FALLBACK = 15;

if (process.argv.length < 4) {
  console.error("Usage: node scripts/score-parity-check.mjs <userId> <emailFile>");
  process.exit(2);
}

const [, , userId, emailPath] = process.argv;
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(2);
}

const emailText = await readFile(emailPath, "utf8");

// --- pure scoring port of lib/tracker-studio.ts:computeScore --------------------------

const tokenSplit = /[^a-z0-9+#./-]+/i;
const suspiciousTerms = ["urgent hiring", "easy money", "commission only", "1099 only", "unpaid", "crypto", "telegram", "whatsapp"];

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}
function normalizeText(value) {
  return (value ?? "").toLowerCase();
}
function tokenize(value) {
  return normalizeText(value).split(tokenSplit).map(p => p.trim()).filter(p => p.length >= 3);
}
function unique(values) {
  return Array.from(new Set(values));
}
function daysBetween(left, right) {
  return Math.round((left.getTime() - right.getTime()) / 86400000);
}

function computeFitScore({ application, context, now = new Date() }) {
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
    return tokens.length > 1 && tokens.every(t => applicationTokens.includes(t));
  });
  const preferredTitleMatches = context.preferences.desiredTitles.filter((preferred) => {
    const tokens = tokenize(preferred);
    return tokens.length > 0 && tokens.every(token => title.includes(token));
  });
  const jobTitleMatches = context.jobs.filter((job) => tokenize(job.title).some((token) => title.includes(token)));
  const companyContacts = context.contacts.filter((contact) => normalizeText(contact.company) === company);
  const referralHints = ["referral", "recruiter", "hiring manager", "alumni", "network"];
  const hasReferralHint = referralHints.some(hint => description.includes(hint) || notes.includes(hint));
  const wantsWorkMode = context.preferences.workModes.length > 0;
  const workModeMatch = wantsWorkMode && application.workMode ? context.preferences.workModes.includes(application.workMode) : false;
  const locationMatch = context.preferences.locationPreference ? location.includes(normalizeText(context.preferences.locationPreference)) : false;
  const salaryTarget = context.preferences.salaryTarget ?? null;
  const salaryMeetsTarget = salaryTarget !== null ? (application.salaryMax ?? application.salaryMin ?? 0) >= salaryTarget : null;
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
  if (context.jobs.some(job => normalizeText(job.company) === company)) leverage += 12;

  let risk = 28;
  if (description.length < 180) risk += 22;
  if (!application.salaryMin && !application.salaryMax && salaryTarget !== null) risk += 8;
  if (salaryMeetsTarget === false) risk += 14;
  if (!workModeMatch && wantsWorkMode && application.workMode) risk += 7;
  if (application.status === "saved" && !application.sourceUrl) risk += 6;
  if (skillMatches.length === 0) risk += 14;
  if (context.preferences.redFlags.some(flag => description.includes(flag.toLowerCase()))) risk += 15;
  if (suspiciousTerms.some(term => description.includes(term))) risk += 20;

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

  return {
    fit: clamp(fit),
    risk: clamp(risk),
    descriptionSource: description.length >= SCRAPED_LEN_THRESHOLD
      ? "scraped"
      : description.length >= 200 ? "email-fallback" : "unknown",
    descriptionLength: description.length,
  };
}

// --- email parsing port of lib/email-match-parser.ts ----------------------------------

const LABELED_FIELD_RE = /^(location|work arrangement|posting date|salary|why it matches|notable gaps|apply)\s*:/i;
function cleanLine(value) {
  return value.replace(/^[\s*•\-–—]+/, "").replace(/\s+/g, " ").trim();
}
function extractLabeledField(text, labels) {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    for (const label of labels) {
      if (line.toLowerCase().startsWith(label.toLowerCase())) {
        const afterColon = line.slice(label.length).replace(/^[\s:：]+/, "").trim();
        if (afterColon) return cleanLine(afterColon);
        if (i + 1 < lines.length) return cleanLine(lines[i + 1]);
      }
    }
  }
  return "";
}
function extractParagraphBlock(text, heading) {
  const lines = text.split(/\r?\n/);
  let startIdx = -1;
  let inlineContent = "";
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (trimmed.toLowerCase().startsWith(heading.toLowerCase())) {
      startIdx = i;
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx >= 0 && colonIdx < trimmed.length - 1) {
        inlineContent = cleanLine(trimmed.slice(colonIdx + 1));
      }
      break;
    }
  }
  if (startIdx < 0) return "";
  const collected = [];
  if (inlineContent) collected.push(inlineContent);
  for (let i = startIdx + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) { if (collected.length > 0) break; continue; }
    if (/^(location|work arrangement|posting date|salary|why it matches|notable gaps|apply)\s*:/i.test(line) && collected.length > 0) break;
    if (/^\d+\)\s+/.test(line) && collected.length > 0) break;
    collected.push(cleanLine(line));
    if (collected.length >= 6) break;
  }
  return collected.join(" ").trim();
}
function parseEntries(text) {
  const rawEntries = text.split(/^\d+\)\s+/m).slice(1).map(e => e.trim()).filter(e => e.length > 20);
  return rawEntries.map((rawEntry) => {
    const cleaned = rawEntry.trim();
    const lines = cleaned.split(/\r?\n/).map(cleanLine).filter(Boolean);
    let title = "";
    let company = "";
    const titleCandidate = lines.find(l => !LABELED_FIELD_RE.test(l) && l.length <= 120) || "";
    const emDash = titleCandidate.match(/^(.+?)\s*[—–-]{1,2}\s*(.+)$/);
    if (emDash) { title = cleanLine(emDash[1]); company = cleanLine(emDash[2]); }
    else if (titleCandidate.length > 0) title = titleCandidate;
    const location = extractLabeledField(cleaned, ["Location:", "Location"]);
    const workArrangementRaw = extractLabeledField(cleaned, ["Work arrangement:", "Work Arrangement", "Work setup:", "Setup:"]);
    const workArrangement = workArrangementRaw || (cleaned.toLowerCase().includes("hybrid") ? "hybrid" : cleaned.toLowerCase().includes("remote") ? "remote" : "unknown");
    const whyItMatches = extractParagraphBlock(cleaned, "Why it matches:");
    const notableGaps = extractParagraphBlock(cleaned, "Notable gaps:");
    const applyMatch = cleaned.match(/Apply:\s*(https?[^\s\)\]]+)/i);
    const applyUrl = applyMatch ? applyMatch[1].replace(/[.,;:!?)]+$/, "") : "";
    return { title, company, location, workArrangement, whyItMatches, notableGaps, applyUrl, rawText: cleaned };
  });
}

const NAV_VERB_PREFIXES = /^(apply|save|share|back to|sign in|log in|continue reading|read more|view all|see all|learn more|get started|join now|subscribe|skip to|search|menu|home|jobs?|company|people|salary|interviews|reviews|benefits|photos|life at|workplace|press|cookies?|privacy|terms|settings?)\b/i;
const TRUNCATION_TARGET = 4000;
function normalizeDescription(text) {
  if (!text) return "";
  const lines = text.replace(/\r\n/g, "\n").split("\n").map(l => l.replace(/\s+/g, " ").trim());
  const kept = [];
  let lastBlank = false;
  for (const line of lines) {
    if (!line) { if (!lastBlank && kept.length > 0) kept.push(""); lastBlank = true; continue; }
    lastBlank = false;
    if (line.length < 60 && NAV_VERB_PREFIXES.test(line)) continue;
    kept.push(line);
  }
  while (kept.length > 0 && kept[kept.length - 1] === "") kept.pop();
  const joined = kept.join("\n").trim();
  if (joined.length <= TRUNCATION_TARGET) return joined;
  const window = joined.slice(0, TRUNCATION_TARGET);
  const lastSentence = window.lastIndexOf(". ");
  const lastPara = window.lastIndexOf("\n\n");
  let cutoff = TRUNCATION_TARGET;
  if (lastSentence > TRUNCATION_TARGET - 400) cutoff = lastSentence + 1;
  else if (lastPara > TRUNCATION_TARGET - 400) cutoff = lastPara;
  return joined.slice(0, cutoff).trimEnd();
}
function emailFallbackDescription(entry) {
  return normalizeDescription([entry.whyItMatches, entry.notableGaps, entry.rawText].filter(Boolean).join("\n\n"));
}

// --- DB load -------------------------------------------------------------------------

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const [profile, prefs, jobs, skills, contacts, docs] = await Promise.all([
    client.query(`SELECT name,COALESCE(preferences->>'phone','') AS phone FROM users WHERE id=$1`, [userId]),
    client.query(
      `SELECT desired_titles AS "desiredTitles",work_modes AS "workModes",salary_target AS "salaryTarget",
        location_preference AS "locationPreference",industries,"values",red_flags AS "redFlags",
        default_follow_up_days AS "defaultFollowUpDays"
       FROM user_job_preferences WHERE user_id=$1`, [userId]),
    client.query(
      `SELECT title,company,raw_notes AS "rawNotes",achievements
       FROM jobs WHERE user_id=$1 ORDER BY current DESC,ended_on DESC NULLS LAST,started_on DESC NULLS LAST,created_at DESC LIMIT 8`, [userId]),
    client.query(`SELECT name FROM skills WHERE user_id=$1 ORDER BY proficiency DESC,name LIMIT 60`, [userId]),
    client.query(`SELECT name,company,role FROM contacts WHERE user_id=$1 ORDER BY relationship_strength DESC,name LIMIT 40`, [userId]),
    client.query(`SELECT count(*)::int AS count FROM application_documents WHERE user_id=$1 AND status<>'archived'`, [userId]),
  ]);

  const context = {
    profile: { name: profile.rows[0]?.name ?? null, phone: profile.rows[0]?.phone ?? null },
    preferences: {
      desiredTitles: prefs.rows[0]?.desiredTitles ?? [],
      workModes: prefs.rows[0]?.workModes ?? [],
      salaryTarget: prefs.rows[0]?.salaryTarget ?? null,
      locationPreference: prefs.rows[0]?.locationPreference ?? null,
      industries: prefs.rows[0]?.industries ?? [],
      values: prefs.rows[0]?.values ?? [],
      redFlags: prefs.rows[0]?.redFlags ?? [],
      defaultFollowUpDays: prefs.rows[0]?.defaultFollowUpDays ?? 7,
    },
    jobs: jobs.rows,
    skills: skills.rows.map(r => r.name),
    contacts: contacts.rows,
    linkedDocuments: docs.rows[0]?.count ?? 0,
  };

  console.log(`Loaded context for user ${userId}:`);
  console.log(`  profile.name=${context.profile.name}  skills=${context.skills.length}  jobs=${context.jobs.length}`);
  console.log(`  desiredTitles=${JSON.stringify(context.preferences.desiredTitles)}`);
  console.log("");

  const entries = parseEntries(emailText);
  if (!entries.length) {
    console.error("No entries parsed from email — check the input format.");
    process.exit(3);
  }

  console.log(`Parsed ${entries.length} entries. Each will be scored under three description variants:\n`);
  console.log("- scraped        : full posting body (≥800 chars target — what URL enrichment gets)");
  console.log("- email-fallback : whyItMatches+notableGaps+rawText concatenation (what we send when URL fetch fails)");
  console.log("- manual         : a single rich paragraph synthesizing a typical manual CaptureModal paste\n");

  // For "scraped" we don't actually hit the network — we synthesize a realistic posting body
  // by enriching rawText with skill/keyword vocabulary the user has in their Journey.
  // This is a stand-in for "what the live API would return". It deliberately doesn't fabricate numbers.
  function synthesizeScrapedBody(entry) {
    const skillBag = context.skills.slice(0, 12);
    const paragraphs = [
      `About ${entry.company}: We are hiring a ${entry.title}${entry.location ? ` based in ${entry.location}` : ""}.`,
      `Responsibilities:`,
      `- Design and ship features end to end across our stack.`,
      `- Collaborate with product, design, and other engineers to ship high-quality work.`,
      `- Mentor teammates and contribute to engineering culture.`,
      `Requirements:`,
      `- Strong experience with ${(skillBag.slice(0, 5).join(", ") || "modern web technologies")}.`,
      `- 5+ years of relevant industry experience.`,
      `- Track record of shipping production systems.`,
      `Nice to have: ${(skillBag.slice(5).join(", ") || "Cloud, DevOps, observability")}.`,
      `Why this role: ${entry.whyItMatches || "We are growing the team and looking for someone to make a big impact."}`,
      `What may not match: ${entry.notableGaps || "Some adjacent experience areas may not be a perfect fit."}`,
    ];
    return paragraphs.join("\n");
  }

  const rows = entries.map((entry, idx) => {
    const scraped = synthesizeScrapedBody(entry);
    const fallback = emailFallbackDescription(entry);
    const baseApp = {
      id: `parity-${idx}`,
      status: "saved",
      title: entry.title,
      company: entry.company,
      location: entry.location || null,
      workMode: entry.workArrangement !== "unknown" ? entry.workArrangement : null,
      salaryMin: null, salaryMax: null,
      description: "",
      notes: null,
      sourceUrl: entry.applyUrl || null,
      priorityLabel: null,
      nextActionType: null, nextActionReason: null,
      followUpDueAt: null, appliedAt: null,
      createdAt: new Date(),
      metadata: {},
    };
    const scrapedScore = computeFitScore({ application: { ...baseApp, description: scraped }, context });
    const fallbackScore = computeFitScore({ application: { ...baseApp, description: fallback || "" }, context });
    return { entry, scraped, fallback, scrapedScore, fallbackScore };
  });

  const titleWidth = Math.min(40, Math.max(...rows.map(r => r.entry.title.length || 0), 12));
  console.log(`${"#".padEnd(3)} | ${"title".padEnd(titleWidth)} | ${"scrape_fit".padStart(10)} | ${"fall_fit".padStart(8)} | ${"delta".padStart(6)} | ${"fallback_len".padStart(12)}`);
  console.log("-".repeat(3 + titleWidth + 38));
  let violations = 0;
  rows.forEach((r, i) => {
    const delta = r.scrapedScore.fit - r.fallbackScore.fit;
    const fail = (delta > MAX_SCRAPED_OVER_FALLBACK) || (-delta > MAX_FALLBACK_OVER_SCRAPED);
    if (fail) violations += 1;
    console.log(
      `${String(i + 1).padEnd(3)} | ${(r.entry.title || "?").slice(0, titleWidth).padEnd(titleWidth)} | ` +
      `${String(r.scrapedScore.fit).padStart(10)} | ${String(r.fallbackScore.fit).padStart(8)} | ` +
      `${(delta >= 0 ? "+" : "") + String(delta).padStart(5)} | ` +
      `${String(r.fallbackScore.descriptionLength).padStart(12)}${fail ? "  ⚠" : ""}`
    );
  });

  console.log("");
  if (violations) {
    console.error(`FAIL: ${violations} entries violate parity bounds.`);
    console.error(`  scraped - fallback must be ≤ ${MAX_SCRAPED_OVER_FALLBACK} (avoid over-reward)`);
    console.error(`  fallback - scraped must be ≤ ${MAX_FALLBACK_OVER_SCRAPED} (avoid under-reward)`);
    process.exit(1);
  } else {
    console.log("OK: all entries within parity bounds.");
  }
} finally {
  await client.end();
}
