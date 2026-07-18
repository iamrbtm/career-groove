import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();
  const result = await db.query(
    `SELECT s.id,s.name,s.proficiency,s.category,count(js.job_id)::int AS "chapterCount"
     FROM skills s LEFT JOIN job_skills js ON js.skill_id=s.id
     WHERE s.user_id=$1 GROUP BY s.id ORDER BY s.proficiency DESC,s.name`,
    [user],
  );
  return Response.json({ skills: result.rows });
}
