import type { JobDescription } from "@/lib/application-schema";

const SECTION_HEADERS: Array<[keyof JobDescription, string]> = [
  ["summary", "Summary"],
  ["responsibilities", "Responsibilities"],
  ["requiredQualifications", "Required qualifications"],
  ["preferredQualifications", "Preferred qualifications"],
  ["technologies", "Technologies"],
  ["experience", "Experience"],
  ["education", "Education"],
  ["benefits", "Benefits"],
  ["otherRequirements", "Other requirements"],
];

function joinList(values: string[]): string {
  return values.filter((value) => typeof value === "string" && value.trim().length > 0).join("\n");
}

/**
 * Flatten a structured job_description into a single human-readable string.
 * Used as the fallback description when raw text is unavailable, and for
 * modal preview cards. Order and labels match ATS conventions so keyword
 * matching stays interpretable.
 */
export function humanizeJobDescription(description: JobDescription): string {
  if (!description) return "";
  const sections: string[] = [];

  const summary = description.summary?.trim();
  if (summary) sections.push(summary);

  for (const [key, heading] of SECTION_HEADERS) {
    if (key === "summary") continue;
    const value = description[key];
    if (Array.isArray(value)) {
      const body = joinList(value);
      if (body) sections.push(`${heading}:\n${body.split("\n").map((line) => `- ${line}`).join("\n")}`);
    } else if (typeof value === "string" && value.trim().length > 0) {
      sections.push(`${heading}: ${value.trim()}`);
    }
  }

  return sections.join("\n\n").trim();
}
