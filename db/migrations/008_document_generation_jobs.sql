CREATE TABLE IF NOT EXISTS document_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('resume','cover_letter','both')),
  target_job JSONB NOT NULL, career_context JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','failed')),
  result JSONB NOT NULL DEFAULT '{}', error TEXT, attempts SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS document_generation_jobs_queue_idx ON document_generation_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS document_generation_jobs_user_idx ON document_generation_jobs(user_id, created_at DESC);
