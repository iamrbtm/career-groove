import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

const brandSchema = z.object({
  linkedinHeadline: z.string().max(220).optional().nullable(),
  linkedinAbout: z.string().max(3000).optional().nullable(),
  linkedinExperience: z.array(z.object({
    title: z.string(), company: z.string(), startDate: z.string(), endDate: z.string().optional(), description: z.string(),
  })).optional(),
  githubBio: z.string().max(160).optional().nullable(),
  githubPinned: z.array(z.object({ name: z.string(), description: z.string(), url: z.string() })).optional(),
  portfolioBio: z.string().max(2000).optional().nullable(),
  personalStatement: z.string().max(1000).optional().nullable(),
  brandKeywords: z.array(z.string()).optional(),
});

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();
  const result = await db.query(
    `SELECT id, linkedin_headline AS "linkedinHeadline", linkedin_about AS "linkedinAbout",
            linkedin_experience AS "linkedinExperience", github_bio AS "githubBio",
            github_pinned AS "githubPinned", portfolio_bio AS "portfolioBio",
            personal_statement AS "personalStatement", brand_keywords AS "brandKeywords",
            consistency_score AS "consistencyScore", last_scored_at AS "lastScoredAt",
            created_at AS "createdAt", updated_at AS "updatedAt"
     FROM brand_profiles WHERE user_id=$1`,
    [user],
  );
  return Response.json({ brandProfile: result.rows[0] ?? null });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsed = brandSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;

  const existing = await db.query("SELECT id FROM brand_profiles WHERE user_id=$1", [user]);
  if (existing.rowCount) {
    const setters: string[] = [];
    const values: unknown[] = [user];
    let idx = 2;
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;
      const col = key.replace(/[A-Z]/g, (c: string) => `_${c.toLowerCase()}`);
      setters.push(`${col}=$${idx}${key === "linkedinExperience" || key === "githubPinned" || key === "brandKeywords" ? "::jsonb" : ""}`);
      values.push(Array.isArray(value) ? JSON.stringify(value) : value);
      idx++;
    }
    if (!setters.length) return Response.json({ error: "No changes." }, { status: 400 });
    setters.push("updated_at=now()");
    await db.query(`UPDATE brand_profiles SET ${setters.join(", ")} WHERE user_id=$1`, values);
  } else {
    await db.query(
      `INSERT INTO brand_profiles(user_id,linkedin_headline,linkedin_about,linkedin_experience,
        github_bio,github_pinned,portfolio_bio,personal_statement,brand_keywords)
       VALUES($1,$2,$3,$4::jsonb,$5,$6::jsonb,$7,$8,$9::jsonb)`,
      [
        user, input.linkedinHeadline, input.linkedinAbout,
        JSON.stringify(input.linkedinExperience ?? []),
        input.githubBio, JSON.stringify(input.githubPinned ?? []),
        input.portfolioBio, input.personalStatement,
        JSON.stringify(input.brandKeywords ?? []),
      ],
    );
  }

  const result = await db.query(
    `SELECT id, linkedin_headline AS "linkedinHeadline", linkedin_about AS "linkedinAbout",
            linkedin_experience AS "linkedinExperience", github_bio AS "githubBio",
            github_pinned AS "githubPinned", portfolio_bio AS "portfolioBio",
            personal_statement AS "personalStatement", brand_keywords AS "brandKeywords",
            consistency_score AS "consistencyScore", last_scored_at AS "lastScoredAt"
     FROM brand_profiles WHERE user_id=$1`,
    [user],
  );
  return Response.json({ brandProfile: result.rows[0] });
}
