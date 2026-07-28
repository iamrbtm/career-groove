import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";
import { callAI } from "@/lib/call-ai";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const { action = "headline" } = await request.json() as { action: "headline" | "about" | "all" };

  const [profileResult, jobsResult, skillsResult] = await Promise.all([
    db.query(`SELECT name FROM users WHERE id=$1`, [user]),
    db.query(`SELECT title, company, current, achievements FROM jobs WHERE user_id=$1 ORDER BY current DESC, started_on DESC NULLS LAST LIMIT 10`, [user]),
    db.query(`SELECT name FROM skills WHERE user_id=$1 ORDER BY proficiency DESC LIMIT 20`, [user]),
  ]);

  const profile = profileResult.rows[0] ?? { name: "" };
  const jobs = jobsResult.rows;
  const skills = skillsResult.rows.map((r: { name: string }) => r.name);
  const currentJob = jobs.find((j: { current: boolean | null }) => j.current) ?? jobs[0];
  const experienceLines = jobs.map(
    (j: { title: string; company: string; achievements?: string[] }) =>
      `${j.title} at ${j.company}${j.achievements?.length ? ": " + j.achievements.slice(0, 2).join("; ") : ""}`,
  );

  const context = {
    name: profile.name,
    currentRole: currentJob?.title ?? "",
    currentCompany: currentJob?.company ?? "",
    skills,
    experience: experienceLines,
  };

  const systemMessage = `You are a LinkedIn profile optimization expert. Generate ${action === "headline" ? "a headline" : action === "about" ? "an About section" : "a complete profile refresh"} based on the user's actual experience and skills. Be specific, use keywords, and avoid generic phrases. Return only the generated content, no explanations.`;

  try {
    const content = await callAI(user, systemMessage, JSON.stringify(context));
    return Response.json({ content, action });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "AI generation failed." },
      { status: 502 },
    );
  }
}
