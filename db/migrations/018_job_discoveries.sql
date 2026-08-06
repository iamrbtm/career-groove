CREATE TABLE IF NOT EXISTS job_discoveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  work_mode TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  salary_currency TEXT NOT NULL DEFAULT 'USD',
  source_url TEXT,
  source TEXT,
  summary TEXT NOT NULL,
  fit SMALLINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'reviewed' CHECK (status IN ('reviewed','accepted','dismissed')),
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, fingerprint)
);
CREATE INDEX IF NOT EXISTS job_discoveries_user_status_created_idx
  ON job_discoveries(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS job_discoveries_user_url_idx
  ON job_discoveries(user_id, source_url) WHERE source_url IS NOT NULL;
