import { Hono } from "hono";

import { applicationPreferencesSchema } from "@career-groove/shared";

import type { Database } from "../../db.js";
import type { AppVariables } from "../../http.js";
import { jsonError } from "../../http.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import type { SessionService } from "../auth/session-service.js";

interface Dependencies {
  database: Database;
  sessions: SessionService;
}

export function createApplicationAnalyticsRoutes({
  database,
  sessions,
}: Dependencies) {
  const routes = new Hono<{ Variables: AppVariables }>();
  routes.use("*", createAuthMiddleware(sessions));
  routes.get("/", async (context) => {
    const values = [context.get("userId")];
    const [summary, sources, labels, outcomes] = await Promise.all([
      database.query(
        `WITH base AS (
           SELECT * FROM applications
           WHERE user_id=$1 AND archived_at IS NULL
         )
         SELECT count(*)::int AS total,
          count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int
            AS "savedThisWeek",
          count(*) FILTER (
            WHERE status IN ('applied','follow_up','interviewing','offer')
          )::int AS "submittedCount",
          count(*) FILTER (
            WHERE status='follow_up'
              OR (follow_up_due_at IS NOT NULL AND follow_up_due_at <= now())
          )::int AS "followUpsDue",
          count(*) FILTER (
            WHERE follow_up_due_at IS NOT NULL AND follow_up_due_at > now()
          )::int AS "followUpsScheduled",
          count(*) FILTER (WHERE status='interviewing')::int
            AS "interviewsActive",
          count(*) FILTER (WHERE status='offer')::int AS "offersActive",
          count(*) FILTER (WHERE status='rejected')::int AS "rejectionsLogged"
         FROM base`,
        values,
      ),
      database.query(
        `SELECT COALESCE(source,'Unknown') AS source,count(*)::int AS count
         FROM applications
         WHERE user_id=$1 AND archived_at IS NULL
         GROUP BY 1 ORDER BY count DESC,source ASC LIMIT 10`,
        values,
      ),
      database.query(
        `SELECT COALESCE(priority_label,'needs_review') AS label,
          count(*)::int AS count
         FROM applications
         WHERE user_id=$1 AND archived_at IS NULL
         GROUP BY 1 ORDER BY count DESC,label ASC`,
        values,
      ),
      database.query(
        `SELECT outcome,count(*)::int AS count
         FROM application_outcomes
         WHERE user_id=$1 GROUP BY 1 ORDER BY count DESC,outcome ASC`,
        values,
      ),
    ]);
    const data = summary.rows[0] ?? {};
    const total = Number(data.total ?? 0);
    const submittedCount = Number(data.submittedCount ?? 0);
    const interviewsActive = Number(data.interviewsActive ?? 0);
    const followUpsDue = Number(data.followUpsDue ?? 0);
    const followUpsScheduled = Number(data.followUpsScheduled ?? 0);
    return context.json({
      labels: labels.rows,
      outcomes: outcomes.rows,
      sources: sources.rows,
      summary: {
        ...data,
        followUpHealth:
          followUpsDue + followUpsScheduled
            ? Math.round(
                (followUpsScheduled / (followUpsDue + followUpsScheduled)) * 100,
              )
            : 0,
        interviewRate: submittedCount
          ? Math.round((interviewsActive / submittedCount) * 100)
          : 0,
        responseRate: total
          ? Math.round((interviewsActive / total) * 100)
          : 0,
      },
    });
  });
  return routes;
}

export function createApplicationPreferenceRoutes({
  database,
  sessions,
}: Dependencies) {
  const routes = new Hono<{ Variables: AppVariables }>();
  routes.use("*", createAuthMiddleware(sessions));
  routes.get("/", async (context) => {
    const result = await database.query(
      `SELECT desired_titles AS "desiredTitles",work_modes AS "workModes",
        salary_target AS "salaryTarget",
        location_preference AS "locationPreference",industries,"values",
        red_flags AS "redFlags",weekly_pace AS "weeklyPace",
        default_follow_up_days AS "defaultFollowUpDays"
       FROM user_job_preferences WHERE user_id=$1`,
      [context.get("userId")],
    );
    return context.json({
      preferences:
        result.rows[0] ?? applicationPreferencesSchema.parse({}),
    });
  });
  routes.patch("/", async (context) => {
    const parsed = applicationPreferencesSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success) {
      return jsonError(
        context,
        400,
        "invalid_preferences",
        "Invalid application preferences",
        parsed.error.flatten(),
      );
    }
    const input = parsed.data;
    const result = await database.query(
      `INSERT INTO user_job_preferences
        (user_id,desired_titles,work_modes,salary_target,location_preference,
         industries,"values",red_flags,weekly_pace,default_follow_up_days)
       VALUES($1,$2::jsonb,$3::jsonb,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10)
       ON CONFLICT (user_id) DO UPDATE SET
        desired_titles=EXCLUDED.desired_titles,
        work_modes=EXCLUDED.work_modes,
        salary_target=EXCLUDED.salary_target,
        location_preference=EXCLUDED.location_preference,
        industries=EXCLUDED.industries,"values"=EXCLUDED."values",
        red_flags=EXCLUDED.red_flags,weekly_pace=EXCLUDED.weekly_pace,
        default_follow_up_days=EXCLUDED.default_follow_up_days,updated_at=now()
       RETURNING desired_titles AS "desiredTitles",work_modes AS "workModes",
        salary_target AS "salaryTarget",
        location_preference AS "locationPreference",industries,"values",
        red_flags AS "redFlags",weekly_pace AS "weeklyPace",
        default_follow_up_days AS "defaultFollowUpDays"`,
      [
        context.get("userId"),
        JSON.stringify(input.desiredTitles),
        JSON.stringify(input.workModes),
        input.salaryTarget ?? null,
        input.locationPreference || null,
        JSON.stringify(input.industries),
        JSON.stringify(input.values),
        JSON.stringify(input.redFlags),
        input.weeklyPace ?? null,
        input.defaultFollowUpDays,
      ],
    );
    return context.json({ preferences: result.rows[0] });
  });
  return routes;
}
