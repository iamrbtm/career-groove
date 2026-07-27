import { parseJobPost, ParsedJob } from "./job-post-parser";

export interface ResearchResult {
  jobPosting: ParsedJob | null;
  rawJobText: string;
  companyWebsiteText: string;
  searchSnippets: string[];
  sources: string[];
  companyDomain: string;
}

function isSafeUrl(input: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname === "[::1]") return false;
  if (hostname.endsWith(".local") || hostname.endsWith(".internal")) return false;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return false;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return false;
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(hostname)) return false;
  return true;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CareerGroove/1.0; +https://careergroove.app)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const html = await response.text();
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[^;]+;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return null;
  }
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function duckDuckGoSearch(query: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + " 2026")}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; CareerGroove/1.0; +https://careergroove.app)",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) return [];
    const html = await response.text();
    const snippets: string[] = [];
    const snippetRegex = /class="result__snippet"[^>]*>(.*?)<\/(?:a|span)>/gi;
    let match;
    while ((match = snippetRegex.exec(html)) !== null) {
      const clean = match[1].replace(/<[^>]+>/g, "").trim();
      if (clean.length > 20) snippets.push(clean);
      if (snippets.length >= 5) break;
    }
    if (!snippets.length) {
      const altRegex = /class="(?:result__body|snippet)"[^>]*>(.*?)<\/div>/gi;
      while ((match = altRegex.exec(html)) !== null) {
        const clean = match[1].replace(/<[^>]+>/g, "").trim();
        if (clean.length > 20) snippets.push(clean);
        if (snippets.length >= 5) break;
      }
    }
    return snippets;
  } catch {
    return [];
  }
}

export async function researchUrl(url: string): Promise<ResearchResult> {
  if (!isSafeUrl(url)) {
    return {
      jobPosting: null,
      rawJobText: "",
      companyWebsiteText: "",
      searchSnippets: [],
      sources: [],
      companyDomain: extractDomain(url),
    };
  }

  const domain = extractDomain(url);
  const sources: string[] = [url];
  const rawJobText = (await fetchText(url)) || "";

  let jobPosting: ParsedJob | null = null;
  if (rawJobText) {
    try {
      jobPosting = parseJobPost({ text: rawJobText, sourceUrl: url });
    } catch {
      // Parsing is best-effort
    }
  }

  const companyName = jobPosting?.company || "";
  let companyWebsiteText = "";
  if (domain && domain !== "careers." + domain.replace(/^careers\./, "")) {
    const aboutUrls = [
      `https://${domain}/about`,
      `https://${domain}/about-us`,
      `https://${domain}/company`,
      `https://www.${domain}/about`,
      `https://${domain}`,
    ];
    for (const aboutUrl of aboutUrls) {
      const text = await fetchText(aboutUrl);
      if (text && text.length > 100) {
        companyWebsiteText = text;
        if (aboutUrl !== url) sources.push(aboutUrl);
        break;
      }
    }
  }

  let searchSnippets: string[] = [];
  if (companyName) {
    searchSnippets = await duckDuckGoSearch(`${companyName} company career`);
    if (!searchSnippets.length) {
      searchSnippets = await duckDuckGoSearch(`${companyName} company funding product`);
    }
  } else if (domain) {
    searchSnippets = await duckDuckGoSearch(`${domain} company`);
  }

  return {
    jobPosting,
    rawJobText,
    companyWebsiteText,
    searchSnippets,
    sources: [...new Set(sources)],
    companyDomain: domain,
  };
}

export async function researchCompany(companyName: string): Promise<ResearchResult> {
  const sources: string[] = [];
  let companyWebsiteText = "";
  let rawJobText = "";
  let domain = "";

  const searchSnippets = await duckDuckGoSearch(`${companyName} company career 2026`);

  const domainMatch = searchSnippets
    .map((s) => s.match(/https?:\/\/([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.[a-z]{2,}(?:\.[a-z]{2,})?)/i))
    .find(Boolean);
  if (domainMatch) {
    domain = extractDomain(domainMatch[0]);
    const aboutText = await fetchText(`https://${domain}/about`);
    if (aboutText && aboutText.length > 100) {
      companyWebsiteText = aboutText;
      sources.push(`https://${domain}/about`);
    }
  }

  return {
    jobPosting: null,
    rawJobText,
    companyWebsiteText,
    searchSnippets,
    sources: [...new Set(sources)],
    companyDomain: domain,
  };
}

export function buildResearchContext(research: ResearchResult): string {
  const parts: string[] = [];

  if (research.jobPosting) {
    const j = research.jobPosting;
    parts.push("=== JOB POSTING ===");
    parts.push(`Title: ${j.title}`);
    parts.push(`Company: ${j.company}`);
    parts.push(`Location: ${j.location} (${j.workMode})`);
    parts.push(`Salary: ${j.salaryMin ? `$${j.salaryMin.toLocaleString()}` : "Not listed"} - ${j.salaryMax ? `$${j.salaryMax.toLocaleString()}` : "Not listed"} (${j.salaryCurrency})`);
    parts.push(`Summary: ${j.summary}`);
    if (j.requirements.length) parts.push(`Requirements:\n${j.requirements.map((r) => `  • ${r}`).join("\n")}`);
    if (j.responsibilities.length) parts.push(`Responsibilities:\n${j.responsibilities.map((r) => `  • ${r}`).join("\n")}`);
    if (j.mustHaveSkills.length) parts.push(`Must-have skills: ${j.mustHaveSkills.join(", ")}`);
    if (j.niceToHaveSkills.length) parts.push(`Nice-to-have skills: ${j.niceToHaveSkills.join(", ")}`);
    if (j.contactHints.length) parts.push(`Contact hints:\n${j.contactHints.map((h) => `  • ${h}`).join("\n")}`);
    if (j.applicationInstructions.length) parts.push(`Application instructions:\n${j.applicationInstructions.map((i) => `  • ${i}`).join("\n")}`);
    if (j.redFlags.length) parts.push(`⚠️ Red flags: ${j.redFlags.join(", ")}`);
    if (j.missingDetails.length) parts.push(`Missing details: ${j.missingDetails.join(", ")}`);
    parts.push("");
  }

  if (research.companyWebsiteText) {
    parts.push("=== COMPANY WEBSITE === (fetch from about/company page)");
    parts.push(research.companyWebsiteText.slice(0, 3000));
    parts.push("");
  }

  if (research.searchSnippets.length) {
    parts.push("=== WEB SEARCH RESULTS ===");
    research.searchSnippets.forEach((s, i) => {
      parts.push(`${i + 1}. ${s}`);
    });
    parts.push("");
  }

  parts.push(`Sources: ${research.sources.join(", ") || "No external sources fetched"}`);

  return parts.join("\n");
}
