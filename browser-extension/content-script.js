const JOB_SELECTORS = [
  "[data-testid*='job-description' i]",
  "[data-test*='job-description' i]",
  "[data-qa*='job-description' i]",
  "[class*='job-description' i]",
  "[id*='job-description' i]",
  "[class*='jobsearch-JobComponent' i]",
  "[class*='jobs-description' i]",
  "[class*='description__text' i]",
  "[class*='posting' i]",
  "article",
  "main",
];

const extensionApi = globalThis.browser || globalThis.chrome;

function normalizeText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function textFromElement(element) {
  const clone = element.cloneNode(true);
  clone.querySelectorAll("script, style, svg, canvas, iframe, noscript, nav, footer, header").forEach((node) => node.remove());
  return normalizeText(clone.innerText || clone.textContent || "");
}

function firstMeta(selectors) {
  for (const selector of selectors) {
    const value = document.querySelector(selector)?.getAttribute("content");
    if (value?.trim()) return value.trim();
  }
  return "";
}

const GENERIC_SITE_NAMES = ["linkedin", "indeed", "glassdoor", "monster", "ziprecruiter", "careerbuilder", "job", "jobs", "career", "careers", "career site", "opportunity", "apply", "position"];
const COMPANY_SELECTORS = [
  "[data-testid*='company-name' i]",
  "[data-testid*='company' i]",
  "[data-test*='company' i]",
  "[data-qa*='company' i]",
  "[data-company*='' i]",
  "[class*='company-name' i]",
  "[class*='posting-company' i]",
  "[class*='jobsearch-InlineCompanyRating' i]",
  "[class*='job-details-jobs-unified-top-card__company-name' i]",
  "[class*='employer-name' i]",
  "[class*='employer' i]",
  "[class*='organization' i]",
  "[id*='company' i]",
  "[id*='employer' i]",
];

function looksLikeCompanyName(value) {
  const text = normalizeText(value);
  if (!text || text.length < 2 || text.length > 100 || /\n/.test(text)) return "";
  if (text.split(/\s+/).length > 8) return "";
  if (GENERIC_SITE_NAMES.some((word) => text.toLowerCase().includes(word))) return "";
  return text;
}

function extractCompany() {
  const metaSelectors = [
    "meta[property='og:company']",
    "meta[name='company']",
    "meta[itemprop='name']",
    "meta[property='og:site_name']",
  ];
  for (const selector of metaSelectors) {
    const company = looksLikeCompanyName(document.querySelector(selector)?.getAttribute("content") || "");
    if (company) return company.slice(0, 200);
  }
  for (const selector of COMPANY_SELECTORS) {
    for (const element of document.querySelectorAll(selector)) {
      const company = looksLikeCompanyName(element.innerText || element.textContent || "");
      if (company) return company.slice(0, 200);
    }
  }
  return "";
}

function parseTitleCompany(rawTitle) {
  const clean = normalizeText(rawTitle);
  const separators = [" at ", " - ", " – ", " — ", " | ", " @ "];
  for (const separator of separators) {
    const parts = clean.split(separator).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const company = looksLikeCompanyName(parts[parts.length - 1]);
      if (company) return { title: parts[0], company };
    }
  }
  return { title: clean, company: "" };
}

function extractLargestCandidate() {
  const candidates = [];
  for (const selector of JOB_SELECTORS) {
    document.querySelectorAll(selector).forEach((element) => {
      const text = textFromElement(element);
      if (text.length >= 250) candidates.push({ text, score: text.length + (selector.includes("job") ? 2000 : 0) });
    });
  }
  candidates.sort((left, right) => right.score - left.score);
  return candidates[0]?.text || textFromElement(document.body);
}

function captureJobPost() {
  const heading = document.querySelector("h1")?.innerText || "";
  const metaTitle = firstMeta(["meta[property='og:title']", "meta[name='twitter:title']"]);
  const metaDescription = firstMeta(["meta[property='og:description']", "meta[name='description']", "meta[name='twitter:description']"]);
  const pageTitle = heading || metaTitle || document.title;
  const parsed = parseTitleCompany(pageTitle);
  const company = extractCompany() || parsed.company;
  const bodyText = extractLargestCandidate();
  const description = normalizeText([metaDescription, bodyText].filter(Boolean).join("\n\n")).slice(0, 50000);

  return {
    title: parsed.title.slice(0, 200),
    company: company.slice(0, 200),
    sourceUrl: window.location.href,
    source: window.location.hostname.replace(/^www\./, ""),
    description,
    capturedAt: new Date().toISOString(),
  };
}

extensionApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "CAREER_GROOVE_CAPTURE_JOB") return false;
  try {
    sendResponse({ ok: true, capture: captureJobPost() });
  } catch (error) {
    sendResponse({ ok: false, error: error instanceof Error ? error.message : "Could not read this page." });
  }
  return true;
});
