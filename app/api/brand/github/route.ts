import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";
import { callAI } from "@/lib/call-ai";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const { action = "bio" } = await request.json() as { action: "bio" | "profile" };

  const skillsResult = await db.query(
    `SELECT name FROM skills WHERE user_id=$1 ORDER BY proficiency DESC LIMIT 20`,
    [user],
  );
  const skills = skillsResult.rows.map((r: { name: string }) => r.name);

  const systemMessage = action === "bio"
    ? "Write a concise GitHub profile bio (max 160 characters) based on the user's technical skills. Return only the bio text, no explanations."
    : "Generate a GitHub profile README based on the user's skills. Include: intro, skills/tools table, current focus. Use markdown. Return only the README content.";

  try {
    const content = await callAI(user, systemMessage, JSON.stringify({ skills }));
    return Response.json({ content, action });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "AI generation failed." },
      { status: 502 },
    );
  }
}
