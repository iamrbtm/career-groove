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

function parseTitleCompany(rawTitle) {
  const title = normalizeText(rawTitle).replace(/\s+\|\s+.*$/, "");
  const separators = [" at ", " - ", " – ", " — ", " | "];
  for (const separator of separators) {
    const parts = title.split(separator).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) return { title: parts[0], company: parts[1] };
  }
  return { title, company: "" };
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
  const bodyText = extractLargestCandidate();
  const description = normalizeText([metaDescription, bodyText].filter(Boolean).join("\n\n")).slice(0, 50000);

  return {
    title: parsed.title.slice(0, 200),
    company: parsed.company.slice(0, 200),
    sourceUrl: window.location.href,
    source: window.location.hostname.replace(/^www\./, ""),
    description,
    capturedAt: new Date().toISOString(),
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "CAREER_GROOVE_CAPTURE_JOB") return false;
  try {
    sendResponse({ ok: true, capture: captureJobPost() });
  } catch (error) {
    sendResponse({ ok: false, error: error instanceof Error ? error.message : "Could not read this page." });
  }
  return true;
});
