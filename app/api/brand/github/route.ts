import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const { action = "bio", context } = await request.json() as { action: "bio" | "profile"; context?: Record<string, unknown> };

  const [skillsResult, brandResult] = await Promise.all([
    db.query(`SELECT name FROM skills WHERE user_id=$1 ORDER BY proficiency DESC LIMIT 20`, [user]),
    db.query(`SELECT github_bio, github_pinned FROM brand_profiles WHERE user_id=$1`, [user]),
  ]);

  const skills = skillsResult.rows.map((r: { name: string }) => r.name);
  const existing = brandResult.rows[0] ?? {};

  const enrichedContext = {
    ...context,
    skills,
    existingBio: existing.github_bio,
    existingPinned: existing.github_pinned,
  };

  const systemMessage = action === "bio"
    ? "Write a concise GitHub profile bio (max 160 characters) based on the user's technical skills. Return only the bio text, no explanations."
    : "Generate a GitHub profile README based on the user's skills. Include: intro, skills/tools table, current focus. Use markdown. Return only the README content.";

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
  return Response.json({ content, action });
}
