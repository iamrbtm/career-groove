ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
  ADD COLUMN IF NOT EXISTS source_job_id TEXT,
  ADD COLUMN IF NOT EXISTS canonical_url TEXT,
  ADD COLUMN IF NOT EXISTS posting_date DATE,
  ADD COLUMN IF NOT EXISTS posting_date_text TEXT,
  ADD COLUMN IF NOT EXISTS discovered_date DATE,
  ADD COLUMN IF NOT EXISTS salary_period TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS salary_raw TEXT,
  ADD COLUMN IF NOT EXISTS search_run_date DATE;

DO $$
BEGIN
  ALTER TABLE applications
    ADD CONSTRAINT applications_salary_period_check
    CHECK (salary_period IN ('hour','year','unknown'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS applications_user_dedupe_key_idx
  ON applications(user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
