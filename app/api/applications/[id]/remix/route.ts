import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

const paramsSchema = z.object({ id: z.string().uuid() });
const stopWords = new Set(["and", "the", "with", "for", "you", "your", "will", "are", "that", "this", "from", "have", "has", "our", "but", "not", "all"]);

function tokens(value: string) {
  return value.toLowerCase().split(/[^a-z0-9+#.-]+/).filter((token) => token.length > 2 && !stopWords.has(token));
}

function topTerms(value: string) {
  const counts = new Map<string, number>();
  for (const token of tokens(value)) counts.set(token, (counts.get(token) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 12).map(([token]) => token);
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return Response.json({ error: "Invalid application id" }, { status: 400 });

  const [application, jobs, skills] = await Promise.all([
    db.query(
      `SELECT id,title,company,description,metadata
       FROM applications WHERE id=$1 AND user_id=$2`,
      [parsedParams.data.id, user],
    ),
    db.query(
      `SELECT id,title,company,achievements,raw_notes AS "rawNotes"
       FROM jobs WHERE user_id=$1 ORDER BY current DESC,ended_on DESC NULLS LAST,started_on DESC NULLS LAST LIMIT 8`,
      [user],
    ),
    db.query(`SELECT name FROM skills WHERE user_id=$1 ORDER BY proficiency DESC,name LIMIT 80`, [user]),
  ]);
  if (!application.rowCount) return Response.json({ error: "Application not found" }, { status: 404 });

  const app = application.rows[0];
  const keywords = topTerms(`${app.title} ${app.description}`);
  const skillNames = skills.rows.map((row) => String(row.name));
  const matchedSkills = skillNames.filter((skill) => keywords.includes(skill.toLowerCase()));
  const rankedJobs = jobs.rows.map((job) => {
    const text = `${job.title} ${job.company} ${job.rawNotes || ""} ${(job.achievements || []).join(" ")}`.toLowerCase();
    return { ...job, score: keywords.filter((keyword) => text.includes(keyword)).length };
  }).sort((left, right) => right.score - left.score);
  const topChapters = rankedJobs.filter((job) => job.score > 0).slice(0, 3);
  const missingEvidence = keywords.filter((keyword) => !matchedSkills.some((skill) => skill.toLowerCase() === keyword) && !topChapters.some((job) => `${job.rawNotes || ""} ${(job.achievements || []).join(" ")}`.toLowerCase().includes(keyword))).slice(0, 6);
  const remix = {
    angle: topChapters.length
      ? `Lead with ${topChapters[0].title} evidence and connect it directly to ${app.title}.`
      : `Keep the resume honest and targeted to ${app.title}; add Journey evidence before over-tailoring.`,
    chapters: topChapters.map((job) => ({ id: job.id, title: job.title, company: job.company, reason: `${job.score} role keyword${job.score === 1 ? "" : "s"} overlap.` })),
    keywords,
    skills: matchedSkills.slice(0, 10),
    missingEvidence,
    coverLetterAngle: `Use a short, specific note about why ${app.company} and why this ${app.title} scope, then point to one concrete chapter as proof.`,
    updatedAt: new Date().toISOString(),
  };
  await db.query(
    `UPDATE applications
     SET metadata=jsonb_set(metadata, '{applicationRemix}', $3::jsonb, true),updated_at=now()
     WHERE id=$1 AND user_id=$2`,
    [parsedParams.data.id, user, JSON.stringify(remix)],
  );
  return Response.json({ remix });
}
