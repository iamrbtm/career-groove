import { z } from "zod";

export const parsedJobSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string(),
  workMode: z.enum(["remote", "hybrid", "onsite", "flexible", "unknown"]),
  salaryMin: z.number().int().nullable(),
  salaryMax: z.number().int().nullable(),
  salaryCurrency: z.string(),
  sourceUrl: z.string(),
  source: z.string(),
  summary: z.string(),
  mustHaveSkills: z.array(z.string()),
  niceToHaveSkills: z.array(z.string()),
  requirements: z.array(z.string()),
  responsibilities: z.array(z.string()),
  redFlags: z.array(z.string()),
  missingDetails: z.array(z.string()),
  applicationInstructions: z.array(z.string()),
  screeningQuestions: z.array(z.string()),
  contactHints: z.array(z.string()),
  deadline: z.string().nullable(),
  confidence: z.enum(["low", "medium", "high"]),
});

export type ParsedJob = z.infer<typeof parsedJobSchema>;

const skillTerms = [
  "javascript", "typescript", "react", "next.js", "node", "python", "sql", "postgresql", "aws", "azure", "gcp",
  "salesforce", "hubspot", "excel", "tableau", "power bi", "figma", "kubernetes", "docker", "graphql", "rest",
  "customer success", "project management", "vendor management", "scheduling", "analytics", "communication",
  "leadership", "operations", "crm", "data analysis", "machine learning", "ai", "security", "compliance",
];
const redFlagTerms = ["commission only", "unpaid", "1099 only", "telegram", "whatsapp", "easy money", "urgent hiring", "must pay", "training fee"];
const instructionTerms = ["apply", "submit", "send your resume", "cover letter", "portfolio", "assessment", "screening question", "application"];

function cleanLine(value: string) {
  return value.replace(/^[\s*•\-–—]+/, "").replace(/\s+/g, " ").trim();
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function extractSection(lines: string[], headings: string[]) {
  const starts = lines.findIndex((line) => headings.some((heading) => line.toLowerCase().includes(heading)));
  if (starts < 0) return [];
  const collected: string[] = [];
  for (const line of lines.slice(starts + 1)) {
    if (/^(about|requirements|qualifications|responsibilities|what you|you will|benefits|salary|compensation|apply|how to apply)\b/i.test(line) && collected.length) break;
    if (line.length >= 20) collected.push(cleanLine(line));
    if (collected.length >= 8) break;
  }
  return collected;
}

function extractSalary(text: string) {
  const compact = text.replace(/,/g, "");
  const range = compact.match(/\$?\s*(\d{2,3})(?:k|000)?\s*(?:-|to|–|—)\s*\$?\s*(\d{2,3})(?:k|000)?/i);
  if (!range) return { salaryMin: null, salaryMax: null, salaryCurrency: "USD" };
  const left = Number(range[1]);
  const right = Number(range[2]);
  const multiplier = left < 1000 && right < 1000 ? 1000 : 1;
  return { salaryMin: left * multiplier, salaryMax: right * multiplier, salaryCurrency: text.includes("£") ? "GBP" : text.includes("€") ? "EUR" : "USD" };
}

function extractDeadline(text: string) {
  const explicit = text.match(/(?:deadline|apply by|applications close|closing date)[:\s]+([A-Z][a-z]+\.?\s+\d{1,2}(?:,\s+\d{4})?|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/i);
  return explicit?.[1] ?? null;
}

function extractCompanyFromText(text: string, lines: string[]): string {
  const explicit = text.match(/(?:^|\n)\s*(?:about the\s+)?(?:company|employer|organization)\s*[:—–-]\s*([^\n|•]+)/i);
  if (explicit?.[1]) {
    const name = cleanLine(explicit[1]);
    if (name && name.length <= 100 && !/job|position|opportunity|role/i.test(name)) return name;
  }
  for (let index = 0; index < lines.length - 1; index++) {
    const heading = lines[index];
    if (/^(?:about the\s+)?(?:company|employer|organization|who we are|the company)\s*:?$/i.test(heading) || /about (the )?company|our company|the organization/i.test(heading)) {
      const name = cleanLine(lines[index + 1]);
      if (name.length >= 2 && name.length <= 80 && !/job|position|opportunity|role/i.test(name)) return name;
    }
  }
  const atCompany = text.match(/(?:^|\n)\s*(?:at|with)\s+([A-Z][A-Za-z0-9 .&'-]+)[,\s]+(?:we|you|our|the team)/i);
  if (atCompany?.[1]) {
    const name = cleanLine(atCompany[1]);
    if (name.length <= 80) return name;
  }
  const weAre = text.match(/(?:^|\n)\s*we(?:'re| are)\s+([A-Z][A-Za-z0-9 .&'-]+?)(?:[,\s]|$)/i);
  if (weAre?.[1]) {
    const name = cleanLine(weAre[1]);
    if (name.length <= 80) return name;
  }
  return "";
}

function inferWorkMode(text: string): ParsedJob["workMode"] {
  const lower = text.toLowerCase();
  if (lower.includes("hybrid")) return "hybrid";
  if (lower.includes("remote")) return "remote";
  if (lower.includes("on-site") || lower.includes("onsite") || lower.includes("in office")) return "onsite";
  if (lower.includes("flexible")) return "flexible";
  return "unknown";
}

export function parseJobPost(input: { text: string; sourceUrl?: string; fallbackTitle?: string; fallbackCompany?: string }): ParsedJob {
  const text = input.text.trim();
  const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const lower = text.toLowerCase();
  const title = input.fallbackTitle || lines.find((line) => line.length <= 90 && !line.includes(":")) || "";
  const company = input.fallbackCompany || extractCompanyFromText(text, lines);
  const locationMatch = text.match(/(?:location|based in)[:\s]+([^\n]+)/i);
  const salary = extractSalary(text);
  const mustHaveSkills = unique(skillTerms.filter((term) => lower.includes(term)).map((term) => term.replace(/\b\w/g, (char) => char.toUpperCase()))).slice(0, 12);
  const niceToHaveSkills = unique(lines.filter((line) => /nice to have|preferred|bonus|plus/i.test(line)).flatMap((line) => skillTerms.filter((term) => line.toLowerCase().includes(term))).map((term) => term.replace(/\b\w/g, (char) => char.toUpperCase()))).slice(0, 8);
  const requirements = extractSection(lines, ["requirements", "qualifications", "what you bring", "required"]);
  const responsibilities = extractSection(lines, ["responsibilities", "what you will do", "you will", "day to day"]);
  const redFlags = unique(redFlagTerms.filter((term) => lower.includes(term)));
  const applicationInstructions = unique(lines.filter((line) => instructionTerms.some((term) => line.toLowerCase().includes(term))).slice(0, 8));
  const screeningQuestions = unique(lines.filter((line) => line.endsWith("?") || /are you|do you have|tell us|describe/i.test(line)).slice(0, 8));
  const contactHints = unique(lines.filter((line) => /recruiter|hiring manager|referral|contact|email|@/.test(line.toLowerCase())).slice(0, 6));
  const missingDetails = [
    !company && "Company is not clearly identified.",
    !locationMatch && "Location is not clearly identified.",
    salary.salaryMin === null && "Salary range is not clearly listed.",
    !applicationInstructions.length && "Application instructions are not explicit.",
    !extractDeadline(text) && "Application deadline is not listed.",
  ].filter(Boolean) as string[];
  const summarySource = lines.find((line) => line.length > 80) || lines.slice(0, 3).join(" ");
  return parsedJobSchema.parse({
    title,
    company,
    location: cleanLine(locationMatch?.[1] || ""),
    workMode: inferWorkMode(text),
    ...salary,
    sourceUrl: input.sourceUrl || "",
    source: input.sourceUrl ? new URL(input.sourceUrl).hostname.replace(/^www\./, "") : "",
    summary: summarySource.slice(0, 420),
    mustHaveSkills,
    niceToHaveSkills,
    requirements,
    responsibilities,
    redFlags,
    missingDetails,
    applicationInstructions,
    screeningQuestions,
    contactHints,
    deadline: extractDeadline(text),
    confidence: text.length > 600 && (title || company) ? "high" : text.length > 220 ? "medium" : "low",
  });
}
