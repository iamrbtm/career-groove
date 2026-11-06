import { aiComplete } from "./ai";

export async function parseJobFromText(text: string) {
  const system =
    "You extract job details from text. Return ONLY a JSON object with keys: company, title, location, workMode, salaryMin, salaryMax, jobDescription. Use null for unknown values. No markdown, no explanation.";
  const response = await aiComplete(text, system, 2000);
  if (!response) return null;
  const cleaned = response
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      company: typeof parsed.company === "string" ? parsed.company : null,
      title: typeof parsed.title === "string" ? parsed.title : null,
      location: typeof parsed.location === "string" ? parsed.location : null,
      workMode: typeof parsed.workMode === "string" ? parsed.workMode : null,
      salaryMin: typeof parsed.salaryMin === "number" ? parsed.salaryMin : null,
      salaryMax: typeof parsed.salaryMax === "number" ? parsed.salaryMax : null,
      jobDescription: typeof parsed.jobDescription === "string" ? parsed.jobDescription : null,
    };
  } catch {
    return null;
  }
}

export async function parseJobEmail(text: string) {
  const system =
    "You extract job opportunities from an email or text. Return ONLY a JSON array of objects with keys: company, title, location, workMode, jobDescription. Use null for unknown values. No markdown, no explanation.";
  const response = await aiComplete(text, system, 2000);
  if (!response) return null;
  const cleaned = response
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}