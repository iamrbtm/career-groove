export const skillCategories = {
  interpersonal_behavioral: "Interpersonal & Behavioral (Soft Skills)",
  cognitive_methodological: "Cognitive & Methodological",
  technical_digital: "Technical & Digital (Hard Skills)",
  business_operational: "Business & Operational (Hard Skills)",
  specialized_vocational: "Specialized & Vocational",
  other: "Other",
} as const;

export type SkillCategory = keyof typeof skillCategories;
export type InferredSkill = { name: string; category: SkillCategory };

export function parseChapterAI(text: string) {
  const lines = text.split("\n").map((line) => line.replace(/^\s*[-*•\d.)]+\s*/, "").replace(/\*\*/g, "").trim()).filter(Boolean);
  const skillsAt = lines.findIndex((line) => /^skills:?$/i.test(line));
  const bulletLines = (skillsAt >= 0 ? lines.slice(0, skillsAt) : lines).filter((line) => !/^bullets:?$/i.test(line));
  const seen = new Set<string>();
  const skills = (skillsAt >= 0 ? lines.slice(skillsAt + 1) : []).flatMap((line) => {
    const [rawName, rawCategory = "other"] = line.split("|").map((part) => part.trim());
    const category = rawCategory in skillCategories ? rawCategory as SkillCategory : "other";
    const key = rawName.toLocaleLowerCase();
    if (rawName.length < 2 || rawName.length > 120 || rawName.endsWith("?") || seen.has(key)) return [];
    seen.add(key);
    return [{ name: rawName, category }];
  }).slice(0, 20);
  return {
    bullets: bulletLines.filter((line) => line.length > 8 && !line.endsWith("?") && !/^(here are|note:|suggestion|follow-up|#+)/i.test(line)),
    skills,
  };
}
