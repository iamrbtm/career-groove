import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();

  const [summary, sources, labels, outcomes] = await Promise.all([
    db.query(
      `WITH base AS (
         SELECT *
         FROM applications
         WHERE user_id=$1 AND archived_at IS NULL
       )
       SELECT
         count(*)::int AS total,
         count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS "savedThisWeek",
         count(*) FILTER (WHERE status IN ('applied','follow_up','interviewing','offer'))::int AS "submittedCount",
         count(*) FILTER (WHERE status='follow_up' OR (follow_up_due_at IS NOT NULL AND follow_up_due_at <= now()))::int AS "followUpsDue",
         count(*) FILTER (WHERE status='interviewing')::int AS "interviewsActive",
         count(*) FILTER (WHERE status='offer')::int AS "offersActive",
         count(*) FILTER (WHERE status='rejected')::int AS "rejectionsLogged"
       FROM base`,
      [user],
    ),
    db.query(
      `SELECT COALESCE(source,'Unknown') AS source,count(*)::int AS count
       FROM applications
       WHERE user_id=$1 AND archived_at IS NULL
       GROUP BY 1
       ORDER BY count DESC, source ASC
       LIMIT 5`,
      [user],
    ),
    db.query(
      `SELECT COALESCE(priority_label,'needs_review') AS label,count(*)::int AS count
       FROM applications
       WHERE user_id=$1 AND archived_at IS NULL
       GROUP BY 1
       ORDER BY count DESC, label ASC`,
      [user],
    ),
    db.query(
      `SELECT outcome,count(*)::int AS count
       FROM application_outcomes
       WHERE user_id=$1
       GROUP BY 1
       ORDER BY count DESC,outcome ASC`,
      [user],
    ),
  ]);

  const total = summary.rows[0]?.total ?? 0;
  const submittedCount = summary.rows[0]?.submittedCount ?? 0;
  const interviewsActive = summary.rows[0]?.interviewsActive ?? 0;
  return Response.json({
    summary: {
      ...summary.rows[0],
      responseRate: total ? Math.round((interviewsActive / total) * 100) : 0,
      interviewRate: submittedCount ? Math.round((interviewsActive / submittedCount) * 100) : 0,
    },
    sources: sources.rows,
    labels: labels.rows,
    outcomes: outcomes.rows,
  });
}
