export type BrandProfile = {
  id?: string;
  userId?: string;
  linkedinHeadline: string | null;
  linkedinAbout: string | null;
  linkedinExperience: Array<{ title: string; company: string; startDate: string; endDate?: string; description: string }>;
  githubBio: string | null;
  githubPinned: Array<{ name: string; description: string; url: string }>;
  portfolioBio: string | null;
  personalStatement: string | null;
  brandKeywords: string[];
  consistencyScore: number | null;
  lastScoredAt: string | null;
};

export function buildLinkedInPrompt(
  action: "headline" | "about" | "all",
  profile: { name: string; currentRole?: string; currentCompany?: string; skills: string[]; experience: string[] },
): string {
  const base = `The user's name is ${profile.name}.`;

  if (action === "headline") {
    return `${base}
Generate 3 LinkedIn headline variants (max 220 characters each) based on their current role at "${profile.currentCompany ?? "their company"}" and their top skills: ${profile.skills.slice(0, 5).join(", ")}.
Each headline should be attention-grabbing, include relevant keywords for recruiters, and reflect their professional brand.
Return exactly 3 headlines, one per line, no numbering or extra text.`;
  }

  if (action === "about") {
    return `${base}
Write a compelling LinkedIn About section (2-3 short paragraphs) based on their experience:
${profile.experience.map((e) => `- ${e}`).join("\n")}

Top skills: ${profile.skills.join(", ")}.

The tone should be professional but approachable. Focus on impact, expertise, and what drives them. Do not use generic phrases. Make it feel personal and specific to their career story.`;
  }

  return `${base}
Generate a complete LinkedIn profile refresh including:
1. A headline (max 220 chars)
2. An About section (2-3 paragraphs)
3. 5 suggested skills to add to their profile

Base their experience on: ${profile.experience.map((e) => `- ${e}`).join("\n")}
Current skills: ${profile.skills.join(", ")}

Format the response with clear HEADLINE:, ABOUT:, and SKILLS: sections.`;
}

export function buildGitHubPrompt(
  action: "bio" | "profile",
  profile: { name: string; skills: string[]; projects?: string[] },
): string {
  if (action === "bio") {
    return `Write a concise GitHub profile bio (max 160 chars) for ${profile.name}.
Their technical skills include: ${profile.skills.join(", ")}.
Make it focused, technical, and professional. No emojis unless industry-relevant.`;
  }

  return `Generate a complete GitHub profile README for ${profile.name}.
Their skills: ${profile.skills.join(", ")}
Their projects: ${(profile.projects ?? []).map((p) => `- ${p}`).join("\n")}

Include: a brief intro, a table of skills/tools, and a section about current focus.
Keep it clean and technical. Use markdown formatting. Do not include visitor counters or badges unless standard.`;
}

export function buildConsistencyPrompt(
  brandProfile: BrandProfile,
  resumeSummary: string,
  linkedinSummary?: string,
): string {
  return `Compare the following brand elements and identify inconsistencies:

Resume summary: ${resumeSummary}
LinkedIn headline: ${brandProfile.linkedinHeadline ?? "Not set"}
LinkedIn about: ${brandProfile.linkedinAbout ?? "Not set"}
GitHub bio: ${brandProfile.githubBio ?? "Not set"}
Personal statement: ${brandProfile.personalStatement ?? "Not set"}
Brand keywords: ${brandProfile.brandKeywords.join(", ")}

Score the consistency on a scale of 0-100 where:
- 100 = perfectly aligned across all platforms
- 75 = minor wording differences, same core message
- 50 = noticeable differences in tone or emphasis
- 25 = conflicting information or completely different narratives
- 0 = completely disconnected

Return a JSON object with: { "score": number, "gaps": string[], "recommendations": string[] }`;
}

export function calculateConsistencyScore(
  brandProfile: BrandProfile,
  resumeSummary: string,
): { score: number; gaps: string[]; recommendations: string[] } {
  const gaps: string[] = [];
  const recommendations: string[] = [];
  let score = 80;

  if (!brandProfile.linkedinHeadline || brandProfile.linkedinHeadline.length < 10) {
    gaps.push("LinkedIn headline is missing or too short.");
    recommendations.push("Add a keyword-rich LinkedIn headline that matches your target roles.");
    score -= 15;
  }

  if (!brandProfile.linkedinAbout || brandProfile.linkedinAbout.length < 50) {
    gaps.push("LinkedIn About section is missing or too brief.");
    recommendations.push("Write a 2-3 paragraph LinkedIn About section that tells your career story.");
    score -= 15;
  }

  if (!brandProfile.githubBio) {
    gaps.push("GitHub bio is not set.");
    recommendations.push("Add a concise GitHub bio with your technical focus areas.");
    score -= 5;
  }

  if (!brandProfile.personalStatement) {
    gaps.push("No personal statement or professional summary defined.");
    recommendations.push("Create a 2-sentence professional summary that can anchor all your profiles.");
    score -= 10;
  }

  if (brandProfile.brandKeywords.length === 0) {
    gaps.push("No brand keywords defined.");
    recommendations.push("Identify 5-8 keywords that define your professional brand and sprinkle them consistently.");
    score -= 10;
  }

  const resumeWords = resumeSummary.toLowerCase().split(/\s+/);
  const headlineWords = (brandProfile.linkedinHeadline ?? "").toLowerCase().split(/\s+/);
  const overlap = resumeWords.filter((w) => w.length > 3 && headlineWords.includes(w)).length;
  if (headlineWords.length > 3 && overlap < 2) {
    gaps.push("Your LinkedIn headline uses different keywords than your resume summary.");
    recommendations.push("Align headline keywords with the strengths highlighted in your resume.");
    score -= 10;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    gaps,
    recommendations,
  };
}
