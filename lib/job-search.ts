export type RealListing = {
  title: string;
  company: string;
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  sourceUrl: string;
  source: string;
  description: string;
  datePosted: string | null;
};

const entityMap: Record<string, string> = {
  "&amp;": "&",
  "&nbsp;": " ",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
  "&rsquo;": "'",
  "&ldquo;": '"',
  "&rdquo;": '"',
};

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-zA-Z#0-9]+;/g, (entity) => entityMap[entity] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return value.toLowerCase().trim();
  }
}

function makeFingerprint(title: string, company: string) {
  const clean = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
  return `${clean(title)}|${clean(company)}`;
}

function parseSalaryRange(value: string): { min: number | null; max: number | null; currency: string } {
  const text = value.trim();
  if (!text) return { min: null, max: null, currency: "USD" };
  const currency = text.includes("£") ? "GBP" : text.includes("€") ? "EUR" : "USD";
  const compact = text.replace(/[$£€,\s]/g, "");
  const match = compact.match(/(\d+(?:\.\d+)?)\s*[kKmM]?(?:\s*(?:-|to|–|—)\s*)(\d+(?:\.\d+)?)\s*([kKmM])?/i);
  if (match) {
    const suffix = (match[3] || "").toLowerCase();
    const multiplier = suffix === "k" ? 1000 : suffix === "m" ? 1000000 : 1;
    const min = Math.round(Number(match[1]) * multiplier);
    const max = Math.round(Number(match[2]) * multiplier);
    return { min: Number.isFinite(min) ? min : null, max: Number.isFinite(max) ? max : null, currency };
  }
  const single = compact.match(/^(\d+(?:\.\d+)?)\s*([kKmM])$/i);
  if (single) {
    const multiplier = single[2].toLowerCase() === "k" ? 1000 : single[2].toLowerCase() === "m" ? 1000000 : 1;
    const amount = Math.round(Number(single[1]) * multiplier);
    return Number.isFinite(amount) ? { min: amount, max: amount, currency } : { min: null, max: null, currency };
  }
  return { min: null, max: null, currency };
}

function cleanText(value: string | null | undefined, max = 4000) {
  return (value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Accept": "application/json",
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Job board returned ${response.status}`);
  return response.json();
}

function toListings(rows: Array<{ title: string; company: string; location: string | null; salaryMin: number | null; salaryMax: number | null; salaryCurrency: string; sourceUrl: string; source: string; description: string; datePosted: string | null }>): RealListing[] {
  const seen = new Set<string>();
  const seenUrls = new Set<string>();
  const listings: RealListing[] = [];
  for (const row of rows) {
    const fingerprint = makeFingerprint(row.title, row.company);
    const urlKey = normalizeUrl(row.sourceUrl);
    if (seen.has(fingerprint) || (urlKey && seenUrls.has(urlKey))) continue;
    seen.add(fingerprint);
    if (urlKey) seenUrls.add(urlKey);
    listings.push(row);
  }
  return listings;
}

async function searchRemotive(): Promise<RealListing[]> {
  const body = (await fetchJson("https://remotive.com/api/remote-jobs")) as { jobs?: Array<{ title?: string; company_name?: string; candidate_required_location?: string; salary?: string; url?: string; description?: string; publication_date?: string; job_type?: string }> };
  return toListings(
    (body.jobs ?? [])
      .filter((job) => job.title && job.company_name && job.url)
      .slice(0, 100)
      .map((job) => {
        const salary = parseSalaryRange(job.salary || "");
        const description = cleanText(stripHtml(job.description || ""), 4000);
        return {
          title: (job.title as string).trim().slice(0, 240),
          company: (job.company_name as string).trim().slice(0, 240),
          location: cleanText(job.candidate_required_location, 240) || null,
          salaryMin: salary.min,
          salaryMax: salary.max,
          salaryCurrency: salary.currency,
          sourceUrl: job.url as string,
          source: "remotive.com",
          description,
          datePosted: job.publication_date ?? null,
        };
      })
      .filter((listing) => !/not finding your fit/i.test(listing.title)),
  );
}

async function searchJobicy(query: string): Promise<RealListing[]> {
  const body = (await fetchJson(`https://jobicy.com/api/v2/remote-jobs?tag=${encodeURIComponent(query)}&count=15`)) as { jobs?: Array<{ jobTitle?: string; companyName?: string; jobGeo?: string; jobDescription?: string; jobExcerpt?: string; url?: string; pubDate?: string }> };
  return toListings(
    (body.jobs ?? [])
      .filter((job) => job.jobTitle && job.companyName && job.url)
      .map((job) => {
        const description = cleanText(stripHtml(job.jobDescription || job.jobExcerpt || ""), 4000);
        return {
          title: (job.jobTitle as string).trim().slice(0, 240),
          company: (job.companyName as string).trim().slice(0, 240),
          location: cleanText(job.jobGeo, 240) || null,
          salaryMin: null,
          salaryMax: null,
          salaryCurrency: "USD",
          sourceUrl: job.url as string,
          source: "jobicy.com",
          description,
          datePosted: job.pubDate ?? null,
        };
      }),
  );
}

async function searchRemoteOk(tags: string): Promise<RealListing[]> {
  const body = (await fetchJson(`https://remoteok.com/api?tags=${encodeURIComponent(tags)}`)) as Array<{ position?: string; company?: string; location?: string; salary_min?: number; salary_max?: number; apply_url?: string; description?: string; epoch?: number; tags?: string[] }>;
  return toListings(
    body
      .filter((job) => job.position && job.company && job.apply_url)
      .slice(0, 60)
      .map((job) => {
        const description = cleanText(stripHtml(job.description || ""), 4000);
        const salaryMin = typeof job.salary_min === "number" && job.salary_min > 0 ? job.salary_min : null;
        const salaryMax = typeof job.salary_max === "number" && job.salary_max > 0 ? job.salary_max : null;
        return {
          title: (job.position as string).trim().slice(0, 240),
          company: (job.company as string).trim().slice(0, 240),
          location: cleanText(job.location, 240) || null,
          salaryMin,
          salaryMax,
          salaryCurrency: "USD",
          sourceUrl: job.apply_url as string,
          source: "remoteok.com",
          description,
          datePosted: job.epoch ? new Date(job.epoch * 1000).toISOString() : null,
        };
      })
      .filter((listing) => !/not finding your fit/i.test(listing.title)),
  );
}

const JOBICY_TAGS = ["support", "customer-success", "customer-service", "implementation", "onboarding", "saas", "success", "analyst", "technical-support", "help-desk"];

export async function fetchRealListings(querySets: { titles: string[]; skills: string[] }): Promise<RealListing[]> {
  const titles = [...new Set(querySets.titles.map((title) => title.trim().toLowerCase()).filter(Boolean))];
  const derivedTags = titles
    .map((title) => title.split(/\s+/).slice(-2).join("-"))
    .filter((tag) => /^[a-z0-9-]{3,}$/.test(tag) && !JOBICY_TAGS.includes(tag))
    .slice(0, 2);
  const tags = [...JOBICY_TAGS, ...derivedTags];

  const requests: Array<Promise<RealListing[]>> = [];
  for (const tag of tags) {
    requests.push(searchJobicy(tag).catch(() => []));
  }
  requests.push(searchRemotive().catch(() => []));
  requests.push(searchRemoteOk("success,support").catch(() => []));

  const results = await Promise.allSettled(requests);
  const combined: RealListing[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") combined.push(...result.value);
  }
  const deduped = toListings(combined);
  deduped.sort((left, right) => (right.datePosted ?? "").localeCompare(left.datePosted ?? ""));
  return deduped.slice(0, 150);
}
