CREATE TABLE IF NOT EXISTS application_answer_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  question_key TEXT NOT NULL,
  canonical_answer TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'job_specific' CHECK (kind IN ('standard_profile','job_specific')),
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('low','medium','high')),
  source TEXT,
  tags JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, question_key)
);

CREATE TABLE IF NOT EXISTS application_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  library_answer_id UUID REFERENCES application_answer_library(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'job_specific' CHECK (kind IN ('standard_profile','job_specific')),
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('low','medium','high')),
  source TEXT,
  position SMALLINT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS application_answer_library_user_updated_idx ON application_answer_library(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS application_answers_user_app_position_idx ON application_answers(user_id, application_id, position);
CREATE INDEX IF NOT EXISTS application_answers_library_idx ON application_answers(library_answer_id);
