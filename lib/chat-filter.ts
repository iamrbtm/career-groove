const CAREER_KEYWORDS = [
  "job", "career", "resume", "cv", "cover letter", "application", "apply", "hiring",
  "interview", "salary", "position", "role", "company", "employer", "recruiter",
  "tech stack", "work", "employment", "internship", "remote", "hybrid", "onsite",
  "startup", "industry", "profession", "job posting", "job description",
  "career change", "promotion", "layoff", "firing", "quit", "notice period",
  "background check", "offer", "negotiation", "benefits", "equity", "stock options",
  "linkedin", "github portfolio", "networking", "referral", "cold email", "outreach",
  "follow up", "job search", "job hunt", "looking for", "open to work",
  "skills", "qualifications", "requirements", "must have", "nice to have",
  "mission", "culture", "values", "product", "funding",
  "series a", "series b", "series c", "seed", "ipo", "acquisition",
  "career groove", "groove", "document studio", "application tracker",
  "company research", "company info", "what do they do", "tell me about",
  "generate resume", "generate cover letter", "write resume", "write cover letter",
  "differentiate", "stand out", "culture fit", "interview prep",
  "work history", "achievements", "accomplishments",
];

const BLOCKED_PATTERNS = [
  /crypto\s*(currency|invest|trade|mining|exchange)/i,
  /gambling|casino/i,
  /adult\s*(content|entertainment|website)/i,
  /illegal|drug\s*(trafficking|dealing)/i,
  /hack(?!athon|errank|news)/i,
  /buy\s*(stock|crypto|nft|coin)/i,
  /political\s*campaign/i,
  /religious\s*conversion/i,
  /pyramid\s*scheme|mlm/i,
  /weapons|firearms/i,
];

const OFF_TOPIC_RESPONSE =
  "Hey there! 🎵 I'm CareerGroove's research sidekick — I'm all about helping you land that dream gig. I can research companies, analyze job postings, help with resumes and cover letters, and get your application groove on. But it sounds like you're asking about something outside the career zone. Let's get back to what matters — your next career move! What company or role are you researching?";

export function isCareerRelevant(text: string): { allowed: boolean; reason?: string } {
  const lower = text.toLowerCase();

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      return { allowed: false, reason: "blocked_topic" };
    }
  }

  const hasCareerSignal = CAREER_KEYWORDS.some((keyword) => lower.includes(keyword));
  const hasUrl = /https?:\/\/[^\s]+/.test(text);
  const hasCompanyName = /^(what|who|tell me about|research|look up|find)\s+.{2,}/i.test(text);

  if (hasUrl || hasCareerSignal || hasCompanyName) {
    return { allowed: true };
  }

  if (text.length < 15) {
    return { allowed: true };
  }

  return { allowed: true };
}

export function offTopicResponse(): string {
  return OFF_TOPIC_RESPONSE;
}

export function postFilterResponse(response: string): string {
  const lower = response.toLowerCase();
  const blockedMatch = BLOCKED_PATTERNS.find((p) => p.test(response));
  if (blockedMatch) {
    return OFF_TOPIC_RESPONSE;
  }
  return response;
}
