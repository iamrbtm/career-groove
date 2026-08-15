/**
 * Daily Job Matches Email Parser
 *
 * Parses emails from job matching services (e.g., Daily Job Matches) into
 * structured job entries. Pure functions — no Next.js or DB dependencies —
 * so they can be reused by a future IMAP inbox sync worker.
 *
 * Future IMAP sync integration point:
 * 1. Worker connects to IMAP inbox, fetches new emails
 * 2. Filters emails by sender/subject matching the Daily Job Matches format
 * 3. Passes raw email text to `parseJobMatchEmail({ text, userId, useAI })`
 * 4. Calls `/api/applications/bulk-create` with parsed jobs
 * 5. Marks email as processed
 */

import { z } from "zod";
import { callAI } from "@/lib/call-ai";
import { emailMatchEntrySchema } from "@/lib/email-match-schema";

export type ParsedJobEntry = z.infer<typeof emailMatchEntrySchema>;

export type ParsedEmailMatch = {
  header: string;
  footer: string;
  jobs: ParsedJobEntry[];
  parseWarnings: string[];
};

const SALARY_RANGE_RE = /\$?\s*([\d,]+)\s*(?:k|K)?\s*(?:-|to|–|—)\s*\$?\s*([\d,]+)\s*(?:k|K)?/;
const SALARY_SINGLE_RE = /\$?\s*([\d,]+)\s*(?:k|K)?/;

function cleanLine(value: string): string {
  return value.replace(/^[\s*•\-–—]+/, "").replace(/\s+/g, " ").trim();
}

function extractSalaryFromText(text: string): { salaryMin: number | null; salaryMax: number | null; salaryCurrency: string } {
  const currency = text.includes("£") ? "GBP" : text.includes("€") ? "EUR" : "USD";
  const compact = text.replace(/,/g, "");
  const rangeMatch = compact.match(SALARY_RANGE_RE);
  if (rangeMatch) {
    const left = parseInt(rangeMatch[1].replace(/,/g, ""), 10);
    const right = parseInt(rangeMatch[2].replace(/,/g, ""), 10);
    const leftK = text.toLowerCase().includes("k") && left < 1000;
    const rightK = text.toLowerCase().includes("k") && right < 1000;
    return {
      salaryMin: leftK ? left * 1000 : left,
      salaryMax: rightK ? right * 1000 : right,
      salaryCurrency: currency,
    };
  }
  const singleMatch = compact.match(SALARY_SINGLE_RE);
  if (singleMatch) {
    const value = parseInt(singleMatch[1].replace(/,/g, ""), 10);
    const isK = text.toLowerCase().includes("k") && value < 1000;
    const finalValue = isK ? value * 1000 : value;
    return { salaryMin: finalValue, salaryMax: null, salaryCurrency: currency };
  }
  return { salaryMin: null, salaryMax: null, salaryCurrency: currency };
}

function applyConfidence(entry: { title: string; company: string; applyUrl: string }): "low" | "medium" | "high" {
  const hasTitle = entry.title.trim().length > 0;
  const hasCompany = entry.company.trim().length > 0;
  const hasUrl = entry.applyUrl.trim().length > 0;
  if (hasTitle && hasCompany && hasUrl) return "high";
  if (hasTitle && hasCompany) return "medium";
  return "low";
}

function inferWorkArrangement(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("hybrid")) return "hybrid";
  if (lower.includes("remote")) return "remote";
  if (lower.includes("on-site") || lower.includes("onsite") || lower.includes("in office")) return "onsite";
  if (lower.includes("flexible")) return "flexible";
  return "unknown";
}

function extractLabeledField(text: string, labels: string[]): string {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    for (const label of labels) {
      if (line.toLowerCase().startsWith(label.toLowerCase())) {
        const afterColon = line.slice(label.length).replace(/^[\s:：]+/, "").trim();
        if (afterColon) return cleanLine(afterColon);
        if (i + 1 < lines.length) {
          const next = cleanLine(lines[i + 1]);
          if (next) return next;
        }
      }
    }
  }
  return "";
}

function extractParagraphBlock(text: string, heading: string): string {
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
  const collected: string[] = [];
  if (inlineContent) collected.push(inlineContent);
  for (let i = startIdx + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) {
      if (collected.length > 0) break;
      continue;
    }
    if (/^(location|work arrangement|posting date|salary|why it matches|notable gaps|apply)\s*:/i.test(line) && collected.length > 0) break;
    if (/^\d+\)\s+/.test(line) && collected.length > 0) break;
    collected.push(cleanLine(line));
    if (collected.length >= 6) break;
  }
  return collected.join(" ").trim();
}

export function splitEmailEntries(text: string): string[] {
  const rawEntries = text.split(/^\d+\)\s+/m);
  return rawEntries
    .slice(1)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 20);
}

const NAV_VERB_PREFIXES = /^(apply|save|share|back to|sign in|log in|continue reading|read more|view all|see all|learn more|get started|join now|subscribe|skip to|search|menu|home|jobs?|company|people|salary|interviews|reviews|benefits|photos|life at|workplace|press|cookies?|privacy|terms|settings?)\b/i;

const TRUNCATION_TARGET = 4000;

export function normalizeDescription(text: string): string {
  if (!text) return "";
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim());
  const kept: string[] = [];
  let lastWasBlank = false;
  for (const line of lines) {
    if (!line) {
      if (!lastWasBlank && kept.length > 0) kept.push("");
      lastWasBlank = true;
      continue;
    }
    lastWasBlank = false;
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

const LABELED_FIELD_RE = /^(location|work arrangement|posting date|salary|why it matches|notable gaps|apply)\s*:/i;

export function parseJobEntry(rawEntryText: string): ParsedJobEntry {
  const cleaned = rawEntryText.trim();
  const lines = cleaned.split(/\r?\n/).map(cleanLine).filter(Boolean);

  let title = "";
  let company = "";
  const titleCandidate = lines.find((line) => !LABELED_FIELD_RE.test(line) && line.length <= 120) || "";
  const emDashMatch = titleCandidate.match(/^(.+?)\s*[—–-]{1,2}\s*(.+)$/);
  if (emDashMatch) {
    title = cleanLine(emDashMatch[1]);
    company = cleanLine(emDashMatch[2]);
  } else if (titleCandidate.length > 0 && titleCandidate.length <= 120) {
    title = titleCandidate;
  }

  const location = extractLabeledField(cleaned, ["Location:", "Location"]);
  const workArrangementRaw = extractLabeledField(cleaned, ["Work arrangement:", "Work Arrangement", "Work setup:", "Setup:"]);
  const workArrangement = workArrangementRaw || inferWorkArrangement(cleaned);
  const postingDate = extractLabeledField(cleaned, ["Posting date:", "Posted:", "Date posted:", "Date:"]);
  const salaryText = extractLabeledField(cleaned, ["Salary:", "Compensation:", "Pay:", "Salary range:"]);
  const salary = salaryText ? extractSalaryFromText(salaryText) : extractSalaryFromText(cleaned);
  const whyItMatches = extractParagraphBlock(cleaned, "Why it matches:");
  const notableGaps = extractParagraphBlock(cleaned, "Notable gaps:");
  const applyMatch = cleaned.match(/Apply:\s*(https?[^\s\)\]]+)/i);
  const applyUrl = applyMatch ? applyMatch[1].replace(/[.,;:!?)]+$/, "") : "";

  return emailMatchEntrySchema.parse({
    title: title || "",
    company: company || "",
    location,
    workArrangement,
    postingDate,
    salaryMin: salary.salaryMin,
    salaryMax: salary.salaryMax,
    salaryCurrency: salary.salaryCurrency,
    whyItMatches,
    notableGaps,
    applyUrl,
    rawText: cleaned,
    confidence: applyConfidence({ title, company, applyUrl }),
  });
}

function extractHeader(text: string): string {
  const firstNumbered = text.search(/^\d+\)\s+/m);
  if (firstNumbered < 0) return text.trim();
  return text.slice(0, firstNumbered).trim();
}

function extractFooter(text: string): string {
  const lastApplyMatch = text.match(/Apply:\s*https?\S+/gi);
  if (!lastApplyMatch) return "";
  const lastMatch = lastApplyMatch[lastApplyMatch.length - 1];
  const lastApplyIdx = text.lastIndexOf(lastMatch);
  if (lastApplyIdx < 0) return "";
  const afterLastApply = text.slice(lastApplyIdx + lastMatch.length).trim();
  if (afterLastApply.length < 10) return "";
  return afterLastApply;
}

async function enrichLowConfidenceWithAI(
  userId: string,
  entry: ParsedJobEntry,
): Promise<ParsedJobEntry> {
  if (entry.confidence !== "low") return entry;
  if (!entry.rawText.trim()) return entry;

  const systemPrompt = `You are a job listing parser. Given a raw text block from a "Daily Job Matches" email, extract the job title, company name, and location. Return JSON only: {"title": "...", "company": "...", "location": "..."}. If a field cannot be determined, use an empty string.`;

  try {
    const result = await Promise.race([
      callAI(userId, systemPrompt, entry.rawText.slice(0, 2000)),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("AI timeout")), 10000),
      ),
    ]);

    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return entry;
    }
    const parsed = JSON.parse(jsonMatch[0]) as { title?: string; company?: string; location?: string };

    const newTitle = entry.title || parsed?.title?.trim() || "";
    const newCompany = entry.company || parsed?.company?.trim() || "";
    const newLocation = entry.location || parsed?.location?.trim() || "";
    const newConfidence = applyConfidence({ title: newTitle, company: newCompany, applyUrl: entry.applyUrl });

    return {
      ...entry,
      title: newTitle,
      company: newCompany,
      location: newLocation,
      confidence: newConfidence === "low" && (newTitle && newCompany) ? "medium" : newConfidence,
    };
  } catch {
    return entry;
  }
}

export async function parseJobMatchEmail({
  text,
  userId,
  useAI = false,
}: {
  text: string;
  userId?: string;
  useAI?: boolean;
}): Promise<ParsedEmailMatch> {
  const rawText = text.trim();
  const header = extractHeader(rawText);
  const footer = extractFooter(rawText);
  const rawEntries = splitEmailEntries(rawText);

  const warnings: string[] = [];
  const jobs: ParsedJobEntry[] = [];

  for (const rawEntry of rawEntries) {
    const entry = parseJobEntry(rawEntry);
    if (!entry.title && !entry.company) {
      warnings.push(`Skipped entry (no title or company found): "${rawEntry.slice(0, 80)}..."`);
      continue;
    }
    if (useAI && userId) {
      const enriched = await enrichLowConfidenceWithAI(userId, entry);
      jobs.push(enriched);
    } else {
      jobs.push(entry);
    }
  }

  return { header, footer, jobs, parseWarnings: warnings };
}
