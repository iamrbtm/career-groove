CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'saved' CHECK (status IN ('saved','researching','ready_to_apply','applied','follow_up','interviewing','offer','rejected','withdrawn','archived')),
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  work_mode TEXT CHECK (work_mode IS NULL OR work_mode IN ('remote','hybrid','onsite','flexible','unknown')),
  salary_min INTEGER,
  salary_max INTEGER,
  salary_currency TEXT NOT NULL DEFAULT 'USD',
  source_url TEXT,
  source TEXT,
  description TEXT NOT NULL,
  notes TEXT,
  priority_label TEXT CHECK (priority_label IS NULL OR priority_label IN ('apply_first','research_before_applying','remix_resume_first','network_first','stretch_role','low_signal_lead','probably_skip','follow_up_now','prep_mode')),
  next_action_type TEXT,
  next_action_reason TEXT,
  follow_up_due_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (salary_min IS NULL OR salary_min >= 0),
  CHECK (salary_max IS NULL OR salary_max >= 0),
  CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max)
);

CREATE TABLE IF NOT EXISTS application_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created','status_changed','note_added','document_linked','contact_linked','follow_up','interview','outcome','archived','updated')),
  title TEXT NOT NULL,
  body TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS application_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  name TEXT,
  company TEXT,
  role TEXT,
  email TEXT,
  phone TEXT,
  relationship TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  document_generation_job_id UUID REFERENCES document_generation_jobs(id) ON DELETE SET NULL,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('resume','cover_letter','other')),
  title TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','generated','submitted','archived')),
  submitted_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS application_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  round_type TEXT NOT NULL DEFAULT 'screen',
  scheduled_at TIMESTAMPTZ,
  interviewer TEXT,
  meeting_link TEXT,
  prep_status TEXT NOT NULL DEFAULT 'not_started' CHECK (prep_status IN ('not_started','prepping','ready','completed')),
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS application_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  fit SMALLINT NOT NULL CHECK (fit BETWEEN 0 AND 100),
  readiness SMALLINT NOT NULL CHECK (readiness BETWEEN 0 AND 100),
  desire SMALLINT NOT NULL CHECK (desire BETWEEN 0 AND 100),
  leverage SMALLINT NOT NULL CHECK (leverage BETWEEN 0 AND 100),
  risk SMALLINT NOT NULL CHECK (risk BETWEEN 0 AND 100),
  timing SMALLINT NOT NULL CHECK (timing BETWEEN 0 AND 100),
  label TEXT NOT NULL CHECK (label IN ('apply_first','research_before_applying','remix_resume_first','network_first','stretch_role','low_signal_lead','probably_skip','follow_up_now','prep_mode')),
  reasons JSONB NOT NULL DEFAULT '[]',
  gaps JSONB NOT NULL DEFAULT '[]',
  next_action TEXT NOT NULL,
  model TEXT,
  context_snapshot JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS application_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  score_snapshot_id UUID REFERENCES application_scores(id) ON DELETE SET NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('rejected','no_response','withdrew','offer','accepted','declined','archived')),
  stage TEXT,
  reason TEXT,
  user_note TEXT,
  source TEXT,
  contact_used BOOLEAN,
  resume_document_id UUID REFERENCES application_documents(id) ON DELETE SET NULL,
  cover_letter_document_id UUID REFERENCES application_documents(id) ON DELETE SET NULL,
  offer JSONB NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS command_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('light','standard','deep','recovery','interview')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','finished','archived')),
  title TEXT NOT NULL DEFAULT 'Today''s Mix',
  recap JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS command_session_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  command_session_id UUID NOT NULL REFERENCES command_sessions(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('capture_job','research_company','remix_resume','draft_cover_letter','answer_questions','apply','follow_up','contact_referral','prep_interview','log_outcome','review_rejection','compare_offer','archive_role')),
  title TEXT NOT NULL,
  reason TEXT,
  route_target TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','skipped','snoozed')),
  completed_event_id UUID REFERENCES application_events(id) ON DELETE SET NULL,
  skip_reason TEXT,
  position SMALLINT NOT NULL DEFAULT 0,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_job_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  desired_titles JSONB NOT NULL DEFAULT '[]',
  work_modes JSONB NOT NULL DEFAULT '[]',
  salary_target INTEGER,
  location_preference TEXT,
  industries JSONB NOT NULL DEFAULT '[]',
  values JSONB NOT NULL DEFAULT '[]',
  red_flags JSONB NOT NULL DEFAULT '[]',
  weekly_pace SMALLINT CHECK (weekly_pace IS NULL OR weekly_pace BETWEEN 0 AND 50),
  default_follow_up_days SMALLINT NOT NULL DEFAULT 7 CHECK (default_follow_up_days BETWEEN 1 AND 60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS applications_user_status_created_idx ON applications(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS applications_user_archived_idx ON applications(user_id, archived_at);
CREATE INDEX IF NOT EXISTS application_events_user_app_time_idx ON application_events(user_id, application_id, occurred_at DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS application_contacts_user_app_idx ON application_contacts(user_id, application_id);
CREATE INDEX IF NOT EXISTS application_documents_user_app_idx ON application_documents(user_id, application_id);
CREATE INDEX IF NOT EXISTS application_interviews_user_scheduled_idx ON application_interviews(user_id, scheduled_at);
CREATE INDEX IF NOT EXISTS application_scores_user_app_created_idx ON application_scores(user_id, application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS application_outcomes_user_app_created_idx ON application_outcomes(user_id, application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS command_sessions_user_status_created_idx ON command_sessions(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS command_session_actions_user_session_position_idx ON command_session_actions(user_id, command_session_id, position);
