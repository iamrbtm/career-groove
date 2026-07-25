import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";
import { applicationPreferencesSchema } from "@/lib/application-schema";

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();
  const result = await db.query(
    `SELECT desired_titles AS "desiredTitles",work_modes AS "workModes",salary_target AS "salaryTarget",
      location_preference AS "locationPreference",industries,"values",red_flags AS "redFlags",
      weekly_pace AS "weeklyPace",default_follow_up_days AS "defaultFollowUpDays"
     FROM user_job_preferences WHERE user_id=$1`,
    [user],
  );
  return Response.json({ preferences: result.rows[0] || applicationPreferencesSchema.parse({}) });
}

export async function PATCH(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsed = applicationPreferencesSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const result = await db.query(
    `INSERT INTO user_job_preferences(user_id,desired_titles,work_modes,salary_target,location_preference,industries,"values",red_flags,weekly_pace,default_follow_up_days)
     VALUES($1,$2::jsonb,$3::jsonb,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10)
     ON CONFLICT (user_id) DO UPDATE SET
       desired_titles=EXCLUDED.desired_titles,work_modes=EXCLUDED.work_modes,salary_target=EXCLUDED.salary_target,
       location_preference=EXCLUDED.location_preference,industries=EXCLUDED.industries,"values"=EXCLUDED."values",
       red_flags=EXCLUDED.red_flags,weekly_pace=EXCLUDED.weekly_pace,
       default_follow_up_days=EXCLUDED.default_follow_up_days,updated_at=now()
     RETURNING desired_titles AS "desiredTitles",work_modes AS "workModes",salary_target AS "salaryTarget",
      location_preference AS "locationPreference",industries,"values",red_flags AS "redFlags",
      weekly_pace AS "weeklyPace",default_follow_up_days AS "defaultFollowUpDays"`,
    [
      user,
      JSON.stringify(input.desiredTitles),
      JSON.stringify(input.workModes),
      input.salaryTarget || null,
      input.locationPreference || null,
      JSON.stringify(input.industries),
      JSON.stringify(input.values),
      JSON.stringify(input.redFlags),
      input.weeklyPace || null,
      input.defaultFollowUpDays,
    ],
  );
  return Response.json({ preferences: result.rows[0] });
}
