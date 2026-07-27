import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const { action = "headline", context } = await request.json() as { action: "headline" | "about" | "all"; context?: Record<string, unknown> };

  const [profileResult, jobsResult, skillsResult, brandResult] = await Promise.all([
    db.query(`SELECT name, COALESCE(preferences->>'phone','') AS phone FROM users WHERE id=$1`, [user]),
    db.query(`SELECT title, company, current, started_on, ended_on, achievements FROM jobs WHERE user_id=$1 ORDER BY current DESC, started_on DESC NULLS LAST LIMIT 10`, [user]),
    db.query(`SELECT name FROM skills WHERE user_id=$1 ORDER BY proficiency DESC LIMIT 20`, [user]),
    db.query(`SELECT linkedin_headline, linkedin_about FROM brand_profiles WHERE user_id=$1`, [user]),
  ]);

  const profile = profileResult.rows[0] ?? { name: "" };
  const jobs = jobsResult.rows;
  const skills = skillsResult.rows.map((r: { name: string }) => r.name);
  const existing = brandResult.rows[0] ?? {};

  const currentJob = jobs.find((j: { current: boolean | null }) => j.current) ?? jobs[0];
  const experienceLines = jobs.map(
    (j: { title: string; company: string; startDate?: string; endDate?: string | null; achievements?: string[] }) =>
      `${j.title} at ${j.company}${(j as { achievements: string[] }).achievements?.length ? ": " + (j as { achievements: string[] }).achievements.slice(0, 2).join("; ") : ""}`,
  );

  const enrichedContext = {
    ...context,
    name: profile.name,
    currentRole: currentJob?.title ?? "",
    currentCompany: currentJob?.company ?? "",
    skills,
    experience: experienceLines,
    existingHeadline: existing.linkedin_headline,
    existingAbout: existing.linkedin_about,
  };

  const systemMessage = `You are a LinkedIn profile optimization expert. Generate ${action === "headline" ? "a headline" : action === "about" ? "an About section" : "a complete profile refresh"} based on the user's actual experience and skills. Be specific, use keywords, and avoid generic phrases. Return only the generated content, no explanations.`;

  const aiResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: request.headers.get("cookie") || "" },
    body: JSON.stringify({
      purpose: "outreach-draft",
      messages: [{ role: "system", content: systemMessage }, { role: "user", content: JSON.stringify(enrichedContext) }],
      context: enrichedContext,
    }),
  });

  if (!aiResponse.ok) {
    const error = await aiResponse.text();
    return Response.json({ error: `AI generation failed: ${error}` }, { status: 502 });
  }

  const content = await aiResponse.text();
  return Response.json({ content, action, profile: enrichedContext });
}
