import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";
import { calculateConsistencyScore, type BrandProfile } from "@/lib/brand-studio";

export async function POST() {
  const user = await requireUser();
  if (!user) return unauthorized();

  const [brandResult, profileResult, jobsResult] = await Promise.all([
    db.query(`SELECT * FROM brand_profiles WHERE user_id=$1`, [user]),
    db.query(`SELECT name, COALESCE(preferences->>'phone','') AS phone FROM users WHERE id=$1`, [user]),
    db.query(`SELECT title, company, current, achievements FROM jobs WHERE user_id=$1 ORDER BY current DESC, started_on DESC NULLS LAST LIMIT 5`, [user]),
  ]);

  if (!brandResult.rowCount) {
    return Response.json({ error: "Create a brand profile first. Add your LinkedIn headline or about section to get started." }, { status: 400 });
  }

  const row = brandResult.rows[0];
  const brandProfile: BrandProfile = {
    linkedinHeadline: row.linkedin_headline,
    linkedinAbout: row.linkedin_about,
    linkedinExperience: row.linkedin_experience ?? [],
    githubBio: row.github_bio,
    githubPinned: row.github_pinned ?? [],
    portfolioBio: row.portfolio_bio,
    personalStatement: row.personal_statement,
    brandKeywords: row.brand_keywords ?? [],
    consistencyScore: row.consistency_score,
    lastScoredAt: row.last_scored_at,
  };

  const resumeSummary = jobsResult.rows.map(
    (j: { title: string; company: string; achievements?: string[] }) =>
      `${j.title} at ${j.company}${(j as { achievements: string[] }).achievements?.length ? ": " + (j as { achievements: string[] }).achievements.join("; ") : ""}`,
  ).join("\n");

  const result = calculateConsistencyScore(brandProfile, resumeSummary);

  await db.query(
    `UPDATE brand_profiles SET consistency_score=$1, last_scored_at=now(), updated_at=now() WHERE user_id=$2`,
    [result.score, user],
  );

  return Response.json({
    score: result.score,
    gaps: result.gaps,
    recommendations: result.recommendations,
    breakdown: {
      headline: brandProfile.linkedinHeadline ? (brandProfile.linkedinHeadline.length > 10 ? "good" : "needs_work") : "missing",
      about: brandProfile.linkedinAbout ? (brandProfile.linkedinAbout.length > 50 ? "good" : "needs_work") : "missing",
      github: brandProfile.githubBio ? "present" : "missing",
      statement: brandProfile.personalStatement ? "present" : "missing",
      keywords: brandProfile.brandKeywords.length >= 3 ? "good" : (brandProfile.brandKeywords.length > 0 ? "needs_work" : "missing"),
    },
  });
}
