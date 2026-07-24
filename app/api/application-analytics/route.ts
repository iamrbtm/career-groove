import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();

  const [summary, sources, labels, outcomes, sourceHealth, resumePerformance, roleFitTrends] = await Promise.all([
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
         count(*) FILTER (WHERE status IN ('applied','follow_up') AND follow_up_due_at IS NOT NULL AND follow_up_due_at > now())::int AS "followUpsScheduled",
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
    db.query(
      `SELECT COALESCE(source,'Unknown') AS source,
        count(*)::int AS total,
        count(*) FILTER (WHERE status IN ('interviewing','offer'))::int AS responses,
        count(*) FILTER (WHERE status='offer')::int AS offers
       FROM applications
       WHERE user_id=$1 AND archived_at IS NULL
       GROUP BY 1
       HAVING count(*) >= 2
       ORDER BY responses DESC,total DESC,source ASC
       LIMIT 5`,
      [user],
    ),
    db.query(
      `SELECT COALESCE(d.title,d.kind,'Untracked version') AS version,
        count(*)::int AS outcomes,
        count(*) FILTER (WHERE o.outcome IN ('offer','accepted'))::int AS positive,
        count(*) FILTER (WHERE o.outcome IN ('rejected','no_response'))::int AS closed
       FROM application_outcomes o
       LEFT JOIN application_documents d ON d.id=o.resume_document_id AND d.user_id=o.user_id
       WHERE o.user_id=$1
       GROUP BY 1
       HAVING count(*) >= 1
       ORDER BY positive DESC,outcomes DESC,version ASC
       LIMIT 5`,
      [user],
    ),
    db.query(
      `SELECT COALESCE(NULLIF(o.offer->>'roleFit',''),'unclear') AS "roleFit",
        COALESCE(NULLIF(o.offer->>'similarStrategy',''),'neutral') AS "similarStrategy",
        count(*)::int AS count
       FROM application_outcomes o
       WHERE o.user_id=$1 AND o.outcome IN ('rejected','no_response','withdrew','declined','accepted')
       GROUP BY 1,2
       ORDER BY count DESC`,
      [user],
    ),
  ]);

  const total = summary.rows[0]?.total ?? 0;
  const submittedCount = summary.rows[0]?.submittedCount ?? 0;
  const interviewsActive = summary.rows[0]?.interviewsActive ?? 0;
  const followUpsDue = summary.rows[0]?.followUpsDue ?? 0;
  const followUpsScheduled = summary.rows[0]?.followUpsScheduled ?? 0;
  return Response.json({
    summary: {
      ...summary.rows[0],
      responseRate: total ? Math.round((interviewsActive / total) * 100) : 0,
      interviewRate: submittedCount ? Math.round((interviewsActive / submittedCount) * 100) : 0,
      followUpHealth: followUpsDue + followUpsScheduled ? Math.round((followUpsScheduled / (followUpsDue + followUpsScheduled)) * 100) : 0,
    },
    sources: sources.rows,
    sourceHealth: sourceHealth.rows.map((row) => ({
      ...row,
      responseRate: row.total ? Math.round((row.responses / row.total) * 100) : 0,
    })),
    resumePerformance: resumePerformance.rows.map((row) => ({
      ...row,
      positiveRate: row.outcomes ? Math.round((row.positive / row.outcomes) * 100) : 0,
    })),
    roleFitTrends: roleFitTrends.rows,
    labels: labels.rows,
    outcomes: outcomes.rows,
  });
}
