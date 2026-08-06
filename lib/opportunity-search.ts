import { generateText } from "ai";
import type { PoolClient } from "pg";

import { db } from "@/lib/db";
import { getModel } from "@/lib/ai";
import { decryptSecret } from "@/lib/secret-box";
import { getSetting, getUserTier } from "@/lib/api-auth";
import { computeScore, loadTrackerContext, refreshApplicationScore, type ApplicationRow } from "@/lib/tracker-studio";
import { fetchRealListings, type RealListing } from "@/lib/job-search";

const SEARCH_LIMIT = 10;

type RawOpportunity = {
  title: string;
  company: string;
  salaryCurrency: string;
  summary: string;
  location: string | null;
  workMode: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  sourceUrl: string | null;
  reason: string | null;
};

export type DiscoveredOpportunity = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  workMode: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  sourceUrl: string | null;
  source: string | null;
  summary: string;
  reason: string | null;
  fit: number;
  label: string;
};

type SeenMap = {
  fingerprints: Set<string>;
  urls: Set<string>;
};

function normalizeText(value: string) {
  return (value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function makeFingerprint(title: string, company: string) {
  return `${normalizeText(title)}|${normalizeText(company)}`;
}

function normalizeUrl(value: string | null | undefined): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return value.toLowerCase().trim();
  }
}

function extractSource(sourceUrl: string | null): string | null {
  if (!sourceUrl) return null;
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function getChatGptModel(userId: string): Promise<ReturnType<typeof getModel> | null> {
  const connections = await db.query(
    `SELECT encrypted_api_key,selected_model,base_url
     FROM provider_connections
     WHERE user_id=$1 AND provider='openai' AND active=true AND selected_model IS NOT NULL
     ORDER BY last_checked_at DESC NULLS LAST LIMIT 1`,
    [userId],
  );
  if (connections.rowCount) {
    const row = connections.rows[0];
    const apiKey = row.encrypted_api_key ? decryptSecret(row.encrypted_api_key) : undefined;
    return getModel("openai", row.selected_model, apiKey, row.base_url);
  }
  const config = await getSetting("premium_ai_config");
  if (config && config.provider === "openai") {
    return getModel("openai", (config.model as string) || undefined, (config.api_key as string) || undefined, (config.base_url as string) || undefined);
  }
  if (process.env.OPENAI_API_KEY) {
    return getModel("openai", process.env.OPENAI_MODEL || "gpt-4o-mini", process.env.OPENAI_API_KEY);
  }
  return null;
}

function buildProfile(context: Awaited<ReturnType<typeof loadTrackerContext>>): string {
  const p = context.preferences;
  const sections: string[] = [];

  const qualifications: string[] = [];
  if (context.jobs.length) {
    qualifications.push("WORK HISTORY:");
    for (const job of context.jobs.slice(0, 6)) {
      if (!job.title && !job.company) continue;
      const line = [`- ${job.title || "Untitled role"} at ${job.company || "Unknown company"}`];
      if (Array.isArray(job.achievements) && job.achievements.length) {
        for (const achievement of job.achievements.slice(0, 3)) {
          if (typeof achievement === "string" && achievement.trim()) line.push(`    • ${achievement.trim().slice(0, 220)}`);
        }
      }
      qualifications.push(line.join("\n"));
    }
  }
  if (context.skills.length) {
    qualifications.push("SKILLS:");
    qualifications.push(context.skills.slice(0, 30).join(", "));
  }
  if (context.profile.name) qualifications.push(`Candidate name: ${context.profile.name}.`);
  if (qualifications.length) {
    sections.push("THE USER'S QUALIFICATIONS:");
    sections.push(qualifications.join("\n"));
  } else {
    sections.push("The user has not added work history or skills yet, so judge roles against the preferences below.");
  }

  const preferences: string[] = [];
  if (p.desiredTitles.length) preferences.push(`Titles they are aiming for: ${p.desiredTitles.join(", ")}.`);
  if (p.workModes.length) preferences.push(`Preferred work modes: ${p.workModes.join(", ")}.`);
  if (p.locationPreference) preferences.push(`Location preference: ${p.locationPreference}.`);
  if (p.salaryTarget != null) preferences.push(`Salary target (annual): $${p.salaryTarget.toLocaleString()}.`);
  if (p.industries.length) preferences.push(`Industries of interest: ${p.industries.join(", ")}.`);
  if (p.redFlags.length) preferences.push(`Avoid anything with: ${p.redFlags.join(", ")}.`);
  if (preferences.length) {
    sections.push("PREFERENCES (use to rank and filter, not to limit the search):");
    sections.push(preferences.join("\n"));
  }
  return sections.join("\n");
}

function buildSearchPrompt(context: Awaited<ReturnType<typeof loadTrackerContext>>): string {
  return [
    `You are the opportunity hunter for CareerGroove. Today's date is ${new Date().toISOString().slice(0, 10)}.`,
    "The user is handing you their qualifications and skills. Your job: find REAL, currently-open job opportunities that their experience genuinely qualifies them for. Read what they have actually done and the skills they have built, then target roles a recruiter would consider them qualified for — not just roles that repeat their wish-list titles.",
    buildProfile(context),
    `Return up to ${SEARCH_LIMIT} opportunities as JSON. For each include:
- title: string, the role title
- company: string, the company name
- location: string or null
- workMode: exactly one of "remote" | "hybrid" | "onsite" | "flexible" | "unknown" (lowercase only)
- salaryMin: integer or null — the published annual salary low. Return a plain integer like 120000, never a string like "$120k"
- salaryMax: integer or null — the published annual salary high (plain integer)
- salaryCurrency: exactly a 3-letter code like "USD"
- sourceUrl: a real public https URL where the role can be applied, or null if you cannot give one
- summary: a 2-3 sentence summary of what the role actually involves
- reason: one short sentence tying the role back to the user's specific qualifications or skills`,
    "RULES: Match the job to the user's actual qualifications first — a role should be something their experience and skills support, even if it is not one of their stated titles. Only real companies and roles you are reasonably confident are hiring now — never invent a posting. Exclude commission-only, unpaid, or obviously low-quality listings. Return ONLY valid JSON in the form {\"opportunities\":[...]} with no markdown, no code fences, and no extra text.",
  ].join("\n");
}

function buildCurationPrompt(context: Awaited<ReturnType<typeof loadTrackerContext>>, listings: RealListing[]): string {
  const listingLines = listings.map((listing, index) => {
    const salary = listing.salaryMin != null && listing.salaryMax != null
      ? `$${listing.salaryMin.toLocaleString()} - $${listing.salaryMax.toLocaleString()}`
      : listing.salaryMin != null
        ? `$${listing.salaryMin.toLocaleString()}+`
        : "not listed";
    return `${index + 1}. ${listing.title} at ${listing.company} — ${listing.location || "Remote"}\n   URL: ${listing.sourceUrl}\n   Salary: ${salary}\n   Description: ${listing.description.slice(0, 400)}`;
  }).join("\n");

  return [
    `You are the opportunity hunter for CareerGroove. Today's date is ${new Date().toISOString().slice(0, 10)}.`,
    "A job board returned the REAL, currently-open listings below. Select up to 10 that best fit the user's qualifications and skills.",
    buildProfile(context),
    "=== CANDIDATE LISTINGS (REAL) ===",
    listingLines,
    `Return up to ${SEARCH_LIMIT} opportunities as JSON, each one copied from a candidate listing. Use the listing's exact real title, company, location, salary, and sourceUrl — do not change or invent those fields. For each include:
- title: the real role title from the listing
- company: the real company name from the listing
- location: the real location string from the listing, or null
- workMode: exactly one of "remote" | "hybrid" | "onsite" | "flexible" | "unknown" (lowercase only; default "remote" for these listings unless it clearly says otherwise)
- salaryMin: integer or null — the real published salary low as a plain integer like 120000
- salaryMax: integer or null — the real published salary high
- salaryCurrency: exactly a 3-letter code like "USD"
- sourceUrl: the real URL from the listing, unchanged
- summary: a 2-3 sentence summary of the role based only on the listing's description
- reason: one short sentence tying the role to the user's specific qualifications or skills`,
    "RULES: Only pick from the candidate listings — never invent postings, companies, or URLs. Prefer the strongest matches to the user's qualifications, skills, salary target, and work-mode preference. Exclude anything commission-only, unpaid, or obviously low-quality. Return ONLY valid JSON in the form {\"opportunities\":[...]} with no markdown, no code fences, and no extra text.",
  ].join("\n");
}

function inferListingWorkMode(listing: RealListing): string {
  const text = `${listing.title} ${listing.location || ""}`.toLowerCase();
  if (text.includes("hybrid")) return "hybrid";
  if (text.includes("on-site") || text.includes("onsite") || text.includes("in office")) return "onsite";
  if (text.includes("flexible")) return "flexible";
  return "remote";
}

const TOKEN_SPLIT = /[^a-z0-9+#./-]+/i;

function tokenize(value: string): string[] {
  return (value || "")
    .toLowerCase()
    .split(TOKEN_SPLIT)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

type TrackerContextLike = Awaited<ReturnType<typeof loadTrackerContext>>;

function toApplicationRow(listing: RealListing): ApplicationRow {
  return {
    id: listing.company,
    status: "saved",
    title: listing.title,
    company: listing.company,
    location: listing.location,
    workMode: inferListingWorkMode(listing),
    salaryMin: listing.salaryMin,
    salaryMax: listing.salaryMax,
    description: listing.description,
    notes: null,
    sourceUrl: listing.sourceUrl,
    priorityLabel: null,
    nextActionType: null,
    nextActionReason: null,
    followUpDueAt: null,
    appliedAt: null,
    createdAt: new Date(),
    metadata: null,
  };
}

function listingRelevance(listing: RealListing, context: TrackerContextLike): { keep: boolean; score: number } {
  const desiredTitles = [
    ...context.preferences.desiredTitles,
    ...context.jobs.map((job) => job.title).filter((title): title is string => Boolean(title)),
  ];
  const titleTokens = new Set(tokenize(listing.title));
  let bestOverlap = 0;
  for (const desired of desiredTitles) {
    const tokens = tokenize(desired);
    if (!tokens.length) continue;
    const matched = tokens.filter((token) => titleTokens.has(token)).length / tokens.length;
    if (matched > bestOverlap) bestOverlap = matched;
  }
  const vocab = new Set(desiredTitles.flatMap((title) => tokenize(title)).filter((token) => token.length >= 4));
  const titleHasTerm = [...titleTokens].some((token) => vocab.has(token));
  const fullText = `${listing.title} ${listing.description}`.toLowerCase();
  const skillHits = context.skills.filter((skill) => {
    const normalized = skill.toLowerCase();
    if (fullText.includes(normalized)) return true;
    const tokens = tokenize(skill);
    return tokens.length > 1 && tokens.every((token) => fullText.includes(token));
  }).length;
  const keep = bestOverlap >= 0.5 || (titleHasTerm && skillHits >= 1);
  return { keep, score: bestOverlap * 40 + Math.min(skillHits, 6) * 8 };
}

function listingFit(listing: RealListing, context: TrackerContextLike): number {
  return computeScore(toApplicationRow(listing), context).fit;
}

function listingsToRaw(listings: RealListing[]): RawOpportunity[] {
  return listings.slice(0, SEARCH_LIMIT).map((listing) => ({
    title: listing.title,
    company: listing.company,
    location: listing.location,
    workMode: inferListingWorkMode(listing),
    salaryMin: listing.salaryMin,
    salaryMax: listing.salaryMax,
    salaryCurrency: listing.salaryCurrency,
    sourceUrl: listing.sourceUrl,
    summary: listing.description.slice(0, 5000) || listing.title,
    reason: null,
  }));
}

function parseSalary(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return Math.round(value);
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[$,\s£€]/g, "").trim();
  const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*([kKmM]?)$/);
  if (!match) return null;
  const number = Number(match[1]);
  const suffix = match[2].toLowerCase();
  const multiplier = suffix === "k" ? 1000 : suffix === "m" ? 1000000 : 1;
  const amount = Math.round(number * multiplier);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function parseWorkMode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const lower = value.toLowerCase();
  if (lower.includes("remote")) return "remote";
  if (lower.includes("hybrid")) return "hybrid";
  if (lower.includes("on-site") || lower.includes("onsite") || lower.includes("in office")) return "onsite";
  if (lower.includes("flexible")) return "flexible";
  return lower === "unknown" || lower === "n/a" || lower === "" ? "unknown" : null;
}

function parseSourceUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  let candidate = value.trim();
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;
  try {
    const url = new URL(candidate);
    if (url.protocol === "https:" || url.protocol === "http:") return url.href;
  } catch {
    return null;
  }
  return null;
}

function normalizeOpportunity(item: unknown): RawOpportunity | null {
  if (!item || typeof item !== "object") return null;
  const raw = item as Record<string, unknown>;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const company = typeof raw.company === "string" ? raw.company.trim() : "";
  const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
  if (!title || !company || !summary) return null;

  const location = typeof raw.location === "string" && raw.location.trim() ? raw.location.trim().slice(0, 240) : null;
  let salaryMin = parseSalary(raw.salaryMin);
  let salaryMax = parseSalary(raw.salaryMax);
  if (salaryMin != null && salaryMax != null && salaryMin > salaryMax) {
    const swap = salaryMin;
    salaryMin = salaryMax;
    salaryMax = swap;
  }
  const currency = typeof raw.salaryCurrency === "string" && /^[a-zA-Z]{3}$/.test(raw.salaryCurrency.trim())
    ? raw.salaryCurrency.trim().toUpperCase()
    : "USD";
  const reason = typeof raw.reason === "string" && raw.reason.trim() ? raw.reason.trim().slice(0, 500) : null;
  const sourceUrl = parseSourceUrl(raw.sourceUrl);

  return {
    title: title.slice(0, 240),
    company: company.slice(0, 240),
    location,
    workMode: parseWorkMode(raw.workMode) ?? "unknown",
    salaryMin,
    salaryMax,
    salaryCurrency: currency,
    sourceUrl,
    summary: summary.slice(0, 5000),
    reason,
  };
}

function parseAiOutput(text: string): RawOpportunity[] {
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      } catch {
        throw new Error("ChatGPT returned opportunities that could not be read.");
      }
    } else {
      throw new Error("ChatGPT returned opportunities that could not be read.");
    }
  }

  const items = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { opportunities?: unknown }).opportunities)
      ? (parsed as { opportunities: unknown[] }).opportunities
      : null;
  if (!items) throw new Error("ChatGPT returned opportunities that could not be read.");

  const opportunities: RawOpportunity[] = [];
  for (const item of items) {
    const normalized = normalizeOpportunity(item);
    if (normalized) opportunities.push(normalized);
    if (opportunities.length >= SEARCH_LIMIT) break;
  }
  if (!opportunities.length && items.length) {
    throw new Error("ChatGPT returned opportunities that could not be read.");
  }
  return opportunities;
}

async function callChatGpt(model: ReturnType<typeof getModel>, system: string, userMessage: string): Promise<RawOpportunity[]> {
  let rawText = "";
  try {
    const result = await generateText({
      model,
      maxRetries: 1,
      system,
      messages: [{ role: "user", content: userMessage }],
    });
    rawText = result.text.trim();
    if (!rawText) return [];
    return parseAiOutput(rawText);
  } catch (error) {
    console.error("Opportunity search parse failed", {
      error: error instanceof Error ? error.message : String(error),
      rawPreview: rawText.slice(0, 800),
    });
    return [];
  }
}

async function loadSeen(client: PoolClient, userId: string): Promise<SeenMap> {
  const fingerprints = new Set<string>();
  const urls = new Set<string>();
  const [applicationsResult, discoveriesResult] = await Promise.all([
    client.query(`SELECT title,company,source_url AS "sourceUrl" FROM applications WHERE user_id=$1`, [userId]),
    client.query(`SELECT fingerprint,source_url AS "sourceUrl" FROM job_discoveries WHERE user_id=$1`, [userId]),
  ]);
  for (const row of applicationsResult.rows) {
    fingerprints.add(makeFingerprint(row.title, row.company));
    const url = normalizeUrl(row.sourceUrl);
    if (url) urls.add(url);
  }
  for (const row of discoveriesResult.rows) {
    fingerprints.add(row.fingerprint);
    const url = normalizeUrl(row.sourceUrl);
    if (url) urls.add(url);
  }
  return { fingerprints, urls };
}

export async function searchOpportunities(userId: string): Promise<{ opportunities: DiscoveredOpportunity[]; skippedCount: number }> {
  const model = await getChatGptModel(userId);
  if (!model) {
    throw new Error("Connect an OpenAI (ChatGPT) provider in Settings first, or add an OPENAI_API_KEY.");
  }

  const readClient = await db.connect();
  let context: Awaited<ReturnType<typeof loadTrackerContext>>;
  try {
    context = await loadTrackerContext(readClient, userId);
  } finally {
    readClient.release();
  }

  const listings = await fetchRealListings({
    titles: context.preferences.desiredTitles,
    skills: context.skills,
  }).catch((error) => {
    console.error("Job board fetch failed", error);
    return [];
  });

  let candidates = listings.filter((listing) => listingRelevance(listing, context).keep);
  if (!candidates.length) candidates = listings;
  candidates.sort((left, right) => listingFit(right, context) - listingFit(left, context));
  const topCandidates = candidates.slice(0, 30);

  const descriptionByKey = new Map<string, string>();
  for (const listing of candidates) {
    const urlKey = normalizeUrl(listing.sourceUrl);
    if (urlKey) descriptionByKey.set(urlKey, listing.description);
    descriptionByKey.set(makeFingerprint(listing.title, listing.company), listing.description);
  }

  let rawOpportunities: RawOpportunity[];
  if (topCandidates.length) {
    const curated = await callChatGpt(
      model,
      buildCurationPrompt(context, topCandidates),
      "Here are my qualifications and skills. Pick the jobs I'm most qualified for from the candidate listings and return them as the JSON described above.",
    );
    rawOpportunities = curated.length ? curated : listingsToRaw(topCandidates);
  } else {
    rawOpportunities = await callChatGpt(
      model,
      buildSearchPrompt(context),
      "Here are my qualifications and skills. Go find the jobs I'm qualified for and return them as the JSON described above.",
    );
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE job_discoveries SET status='dismissed',updated_at=now() WHERE user_id=$1 AND status='reviewed'`,
      [userId],
    );
    const seen = await loadSeen(client, userId);

    const opportunities: DiscoveredOpportunity[] = [];
    let skippedCount = 0;
    for (const item of rawOpportunities) {
      const fingerprint = makeFingerprint(item.title, item.company);
      const url = normalizeUrl(item.sourceUrl);
      if (seen.fingerprints.has(fingerprint) || (url && seen.urls.has(url))) {
        skippedCount += 1;
        continue;
      }
      const fullDescription =
        descriptionByKey.get(normalizeUrl(item.sourceUrl)) ??
        descriptionByKey.get(makeFingerprint(item.title, item.company)) ??
        item.summary;
      const score = computeScore(
        {
          id: item.company,
          status: "saved",
          title: item.title,
          company: item.company,
          location: item.location,
          workMode: item.workMode,
          salaryMin: item.salaryMin,
          salaryMax: item.salaryMax,
          description: fullDescription,
          notes: item.reason ?? null,
          sourceUrl: item.sourceUrl,
          priorityLabel: null,
          nextActionType: null,
          nextActionReason: null,
          followUpDueAt: null,
          appliedAt: null,
          createdAt: new Date(),
          metadata: null,
        },
        context,
      );
      const inserted = await client.query(
        `INSERT INTO job_discoveries(user_id,fingerprint,title,company,location,work_mode,salary_min,salary_max,salary_currency,source_url,source,summary,fit,status,metadata)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'reviewed',$14::jsonb)
         RETURNING id,title,company,location AS "location",work_mode AS "workMode",
          salary_min AS "salaryMin",salary_max AS "salaryMax",salary_currency AS "salaryCurrency",
          source_url AS "sourceUrl",source,summary,fit`,
        [
          userId,
          fingerprint,
          item.title,
          item.company,
          item.location,
          item.workMode,
          item.salaryMin,
          item.salaryMax,
          item.salaryCurrency,
          item.sourceUrl,
          extractSource(item.sourceUrl),
          item.summary,
          score.fit,
          JSON.stringify({ reason: item.reason, label: score.label, skills: score.contextSnapshot?.matchedSkills ?? [] }),
        ],
      );
      seen.fingerprints.add(fingerprint);
      if (url) seen.urls.add(url);
      opportunities.push({
        ...inserted.rows[0],
        salaryCurrency: inserted.rows[0].salaryCurrency ?? "USD",
        summary: item.summary,
        reason: item.reason ?? null,
        label: score.label,
      });
      if (opportunities.length >= SEARCH_LIMIT) break;
    }

    await client.query("COMMIT");
    opportunities.sort((left, right) => right.fit - left.fit);
    return { opportunities, skippedCount };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function acceptOpportunities(userId: string, ids: string[]): Promise<{ accepted: number; applications: unknown[] }> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const select = await client.query(
      `SELECT id,title,company,location,work_mode AS "workMode",salary_min AS "salaryMin",salary_max AS "salaryMax",
        salary_currency AS "salaryCurrency",source_url AS "sourceUrl",source,summary,fit,metadata
       FROM job_discoveries WHERE user_id=$1 AND status='reviewed' AND id = ANY($2::uuid[])`,
      [userId, ids],
    );
    const tier = await getUserTier(userId);
    if (tier === "free") {
      const active = await client.query(
        `SELECT count(*)::int AS count FROM applications WHERE user_id=$1 AND archived_at IS NULL AND status <> 'archived'`,
        [userId],
      );
      const room = 5 - (active.rows[0]?.count ?? 0);
      if (room <= 0) {
        await client.query("ROLLBACK");
        throw new Error("Free plan is limited to 5 active roles. Upgrade to Pro for unlimited tracking.");
      }
      if ((select.rowCount ?? 0) > room) {
        await client.query("ROLLBACK");
        throw new Error(`Free plan is limited to 5 active roles. Select up to ${room} of these to add.`);
      }
    }

    const applications: unknown[] = [];
    for (const row of select.rows) {
      const created = await client.query(
        `INSERT INTO applications(user_id,title,company,location,work_mode,salary_min,salary_max,salary_currency,source_url,source,description,notes,metadata)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
         RETURNING id,status,title,company,location,work_mode AS "workMode",
          salary_min AS "salaryMin",salary_max AS "salaryMax",salary_currency AS "salaryCurrency",
          source_url AS "sourceUrl",source,description,notes,priority_label AS "priorityLabel",
          next_action_type AS "nextActionType",next_action_reason AS "nextActionReason",
          follow_up_due_at AS "followUpDueAt",applied_at AS "appliedAt",archived_at AS "archivedAt",
          metadata,created_at AS "createdAt",updated_at AS "updatedAt"`,
        [
          userId,
          row.title,
          row.company,
          row.location || null,
          row.workMode || null,
          row.salaryMin || null,
          row.salaryMax || null,
          row.salaryCurrency || "USD",
          row.sourceUrl || null,
          row.source || null,
          row.summary,
          row.metadata?.reason ? `Fit reason: ${row.metadata.reason}` : null,
          JSON.stringify({ source: "opportunity_search", opportunityId: row.id, aiFit: row.fit }),
        ],
      );
      await client.query(
        `INSERT INTO application_events(user_id,application_id,event_type,title,body,metadata)
         VALUES($1,$2,'created','Opportunity added from search',$3,$4::jsonb)`,
        [userId, created.rows[0].id, `${row.title} at ${row.company}`, JSON.stringify({ status: "saved", aiFit: row.fit })],
      );
      const score = await refreshApplicationScore(client, userId, created.rows[0].id);
      await client.query(
        `UPDATE job_discoveries SET status='accepted',application_id=$3,updated_at=now() WHERE id=$1 AND user_id=$2`,
        [row.id, userId, created.rows[0].id],
      );
      applications.push({
        ...created.rows[0],
        priorityLabel: score?.priorityLabel ?? created.rows[0].priorityLabel,
        nextActionType: score?.nextActionType ?? created.rows[0].nextActionType,
        nextActionReason: score?.nextActionReason ?? created.rows[0].nextActionReason,
        latestScore: score?.latestScore ?? null,
      });
    }
    await client.query(
      `UPDATE job_discoveries SET status='dismissed',updated_at=now() WHERE user_id=$1 AND status='reviewed'`,
      [userId],
    );
    await client.query("COMMIT");
    return { accepted: applications.length, applications };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
