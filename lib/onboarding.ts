import { db } from "@/lib/db";

export type OnboardingSteps = {
  profile: boolean;
  careerChapters: boolean;
  firstApplication: boolean;
  firstResume: boolean;
};

export const emptyOnboardingSteps: OnboardingSteps = {
  profile: false,
  careerChapters: false,
  firstApplication: false,
  firstResume: false,
};

const onboardingSelect = `
  SELECT
    ((name IS NOT NULL AND btrim(name) <> '') OR COALESCE(preferences->>'phone','') <> '') AS profile,
    EXISTS(SELECT 1 FROM jobs WHERE jobs.user_id = users.id) AS "careerChapters",
    EXISTS(SELECT 1 FROM applications WHERE applications.user_id = users.id) AS "firstApplication",
    EXISTS(SELECT 1 FROM document_generation_jobs WHERE document_generation_jobs.user_id = users.id AND document_generation_jobs.kind = 'resume') AS "firstResume"
  FROM users WHERE id = $1
`;

export async function getOnboardingSteps(userId: string): Promise<OnboardingSteps> {
  const result = await db.query(onboardingSelect, [userId]);
  const row = result.rows[0];
  if (!row) return emptyOnboardingSteps;
  return {
    profile: Boolean(row.profile),
    careerChapters: Boolean(row.careerChapters),
    firstApplication: Boolean(row.firstApplication),
    firstResume: Boolean(row.firstResume),
  };
}

export function isOnboardingComplete(steps: OnboardingSteps): boolean {
  return steps.profile && steps.careerChapters && steps.firstApplication && steps.firstResume;
}
