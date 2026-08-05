CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT, email TEXT UNIQUE NOT NULL,
  "emailVerified" TIMESTAMPTZ, image TEXT, password_hash TEXT, preferences JSONB NOT NULL DEFAULT '{}',
  "stripeCustomerId" TEXT UNIQUE, "stripeSubscriptionId" TEXT UNIQUE, "stripePriceId" TEXT,
  "stripeCurrentPeriodEnd" TIMESTAMPTZ, "subscriptionStatus" TEXT,
  "appStoreOriginalTransactionId" TEXT, "appStoreProductId" TEXT,
  "appStoreEnvironment" TEXT, "appStoreExpiresAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_app_store_original_transaction_idx
  ON users("appStoreOriginalTransactionId") WHERE "appStoreOriginalTransactionId" IS NOT NULL;
CREATE TABLE IF NOT EXISTS app_store_notifications (
  notification_id TEXT PRIMARY KEY, notification_type TEXT, environment TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, provider TEXT NOT NULL, "providerAccountId" TEXT NOT NULL, refresh_token TEXT,
  access_token TEXT, expires_at BIGINT, token_type TEXT, scope TEXT, id_token TEXT, session_state TEXT,
  UNIQUE(provider, "providerAccountId")
);
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "sessionToken" TEXT UNIQUE NOT NULL,
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS verification_token (
  identifier TEXT NOT NULL, token TEXT NOT NULL, expires TIMESTAMPTZ NOT NULL, PRIMARY KEY(identifier, token)
);
CREATE TABLE IF NOT EXISTS authenticators (
  "credentialID" TEXT NOT NULL UNIQUE, "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "providerAccountId" TEXT NOT NULL, "credentialPublicKey" TEXT NOT NULL, counter INTEGER NOT NULL,
  "credentialDeviceType" TEXT NOT NULL, "credentialBackedUp" BOOLEAN NOT NULL, transports TEXT,
  PRIMARY KEY("userId", "credentialID")
);
CREATE TABLE IF NOT EXISTS mobile_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token_hash TEXT NOT NULL UNIQUE, refresh_token_hash TEXT NOT NULL UNIQUE,
  previous_refresh_token_hash TEXT UNIQUE,
  access_expires_at TIMESTAMPTZ NOT NULL, refresh_expires_at TIMESTAMPTZ NOT NULL,
  device_name TEXT, platform TEXT NOT NULL DEFAULT 'ios', last_used_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mobile_sessions_user_active_idx ON mobile_sessions(user_id, refresh_expires_at) WHERE revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS mobile_oauth_codes (
  code_hash TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_challenge TEXT NOT NULL, state_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mobile_oauth_codes_expiry_idx ON mobile_oauth_codes(expires_at);
CREATE TABLE IF NOT EXISTS mobile_passkey_challenges (
  request_id_hash TEXT PRIMARY KEY, challenge_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mobile_passkey_challenges_expiry_idx ON mobile_passkey_challenges(expires_at);
CREATE TABLE IF NOT EXISTS mobile_identity_assertions (
  assertion_id TEXT PRIMARY KEY, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mobile_auth_attempts (
  identifier_hash TEXT NOT NULL, network_hash TEXT NOT NULL, attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mobile_auth_attempts_lookup_idx ON mobile_auth_attempts(identifier_hash, network_hash, attempted_at DESC);
CREATE TABLE IF NOT EXISTS push_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE, device_token TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('sandbox','production')),
  enabled_categories JSONB NOT NULL DEFAULT '[]', app_version TEXT, locale TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_devices_user_idx ON push_devices(user_id, last_seen_at DESC);
CREATE TABLE IF NOT EXISTS mobile_notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), device_id UUID NOT NULL REFERENCES push_devices(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL, category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sending' CHECK (status IN ('sending','sent','failed')),
  error TEXT, sent_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(device_id,source_key)
);
CREATE INDEX IF NOT EXISTS mobile_notification_deliveries_created_idx ON mobile_notification_deliveries(created_at);
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company TEXT NOT NULL, title TEXT NOT NULL, location TEXT, started_on DATE, ended_on DATE, current BOOLEAN DEFAULT false,
  raw_notes TEXT, achievements JSONB NOT NULL DEFAULT '[]', metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL, name TEXT NOT NULL, company TEXT, role TEXT, email TEXT, phone TEXT, relationship_strength SMALLINT DEFAULT 1,
  notes JSONB NOT NULL DEFAULT '[]', links JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS residences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT, address JSONB NOT NULL, started_on DATE, ended_on DATE, metadata JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('license','education','certification')), name TEXT NOT NULL, issuer TEXT,
  issued_on DATE, expires_on DATE, details JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, proficiency SMALLINT NOT NULL DEFAULT 3 CHECK (proficiency BETWEEN 1 AND 5),
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('interpersonal_behavioral','cognitive_methodological','technical_digital','business_operational','specialized_vocational','other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS skills_user_name_idx ON skills(user_id, lower(name));
CREATE TABLE IF NOT EXISTS job_skills (
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY(job_id, skill_id)
);
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('resume','cover_letter','other')), title TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}', target_job JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS document_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('resume','cover_letter','both')),
  target_job JSONB NOT NULL, career_context JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','failed')),
  result JSONB NOT NULL DEFAULT '{}', error TEXT, attempts SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'saved' CHECK (status IN ('saved','researching','ready_to_apply','applied','follow_up','interviewing','offer','rejected','withdrawn','archived')),
  title TEXT NOT NULL, company TEXT NOT NULL, location TEXT,
  work_mode TEXT CHECK (work_mode IS NULL OR work_mode IN ('remote','hybrid','onsite','flexible','unknown')),
  salary_min INTEGER CHECK (salary_min IS NULL OR salary_min >= 0),
  salary_max INTEGER CHECK (salary_max IS NULL OR salary_max >= 0),
  salary_currency TEXT NOT NULL DEFAULT 'USD', source_url TEXT, source TEXT, description TEXT NOT NULL, notes TEXT,
  priority_label TEXT CHECK (priority_label IS NULL OR priority_label IN ('apply_first','research_before_applying','remix_resume_first','network_first','stretch_role','low_signal_lead','probably_skip','follow_up_now','prep_mode')),
  next_action_type TEXT, next_action_reason TEXT, follow_up_due_at TIMESTAMPTZ, applied_at TIMESTAMPTZ, archived_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max)
);
CREATE TABLE IF NOT EXISTS application_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created','status_changed','note_added','document_linked','contact_linked','follow_up','interview','outcome','archived','updated')),
  title TEXT NOT NULL, body TEXT, occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(), metadata JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS application_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE, contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  name TEXT, company TEXT, role TEXT, email TEXT, phone TEXT, relationship TEXT, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  document_generation_job_id UUID REFERENCES document_generation_jobs(id) ON DELETE SET NULL, document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('resume','cover_letter','other')),
  title TEXT, status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','generated','submitted','archived')),
  submitted_at TIMESTAMPTZ, metadata JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS application_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE, round_type TEXT NOT NULL DEFAULT 'screen',
  scheduled_at TIMESTAMPTZ, interviewer TEXT, meeting_link TEXT,
  prep_status TEXT NOT NULL DEFAULT 'not_started' CHECK (prep_status IN ('not_started','prepping','ready','completed')),
  notes TEXT, metadata JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS application_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  fit SMALLINT NOT NULL CHECK (fit BETWEEN 0 AND 100), readiness SMALLINT NOT NULL CHECK (readiness BETWEEN 0 AND 100),
  desire SMALLINT NOT NULL CHECK (desire BETWEEN 0 AND 100), leverage SMALLINT NOT NULL CHECK (leverage BETWEEN 0 AND 100),
  risk SMALLINT NOT NULL CHECK (risk BETWEEN 0 AND 100), timing SMALLINT NOT NULL CHECK (timing BETWEEN 0 AND 100),
  label TEXT NOT NULL CHECK (label IN ('apply_first','research_before_applying','remix_resume_first','network_first','stretch_role','low_signal_lead','probably_skip','follow_up_now','prep_mode')),
  reasons JSONB NOT NULL DEFAULT '[]', gaps JSONB NOT NULL DEFAULT '[]', next_action TEXT NOT NULL, model TEXT,
  context_snapshot JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS application_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE, score_snapshot_id UUID REFERENCES application_scores(id) ON DELETE SET NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('rejected','no_response','withdrew','offer','accepted','declined','archived')),
  stage TEXT, reason TEXT, user_note TEXT, source TEXT, contact_used BOOLEAN,
  resume_document_id UUID REFERENCES application_documents(id) ON DELETE SET NULL,
  cover_letter_document_id UUID REFERENCES application_documents(id) ON DELETE SET NULL,
  offer JSONB NOT NULL DEFAULT '{}',
  role_fit TEXT CHECK (role_fit IN ('stretch','fit','mismatch','unclear')),
  similar_strategy TEXT CHECK (similar_strategy IN ('prioritize','deprioritize','neutral')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS application_answer_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL, question_key TEXT NOT NULL, canonical_answer TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'job_specific' CHECK (kind IN ('standard_profile','job_specific')),
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('low','medium','high')), source TEXT,
  tags JSONB NOT NULL DEFAULT '[]', metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, question_key)
);
CREATE TABLE IF NOT EXISTS application_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  library_answer_id UUID REFERENCES application_answer_library(id) ON DELETE SET NULL,
  question TEXT NOT NULL, answer TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'job_specific' CHECK (kind IN ('standard_profile','job_specific')),
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('low','medium','high')), source TEXT,
  position SMALLINT NOT NULL DEFAULT 0, metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS command_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('light','standard','deep','recovery','interview')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','finished','archived')),
  title TEXT NOT NULL DEFAULT 'Today''s Mix', recap JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(), finished_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS command_session_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  command_session_id UUID NOT NULL REFERENCES command_sessions(id) ON DELETE CASCADE, application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('capture_job','research_company','remix_resume','draft_cover_letter','answer_questions','apply','follow_up','contact_referral','prep_interview','log_outcome','review_rejection','compare_offer','archive_role')),
  title TEXT NOT NULL, reason TEXT, route_target TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','skipped','snoozed')),
  completed_event_id UUID REFERENCES application_events(id) ON DELETE SET NULL, skip_reason TEXT, position SMALLINT NOT NULL DEFAULT 0,
  due_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS user_job_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  desired_titles JSONB NOT NULL DEFAULT '[]', work_modes JSONB NOT NULL DEFAULT '[]',
  salary_target INTEGER, location_preference TEXT, industries JSONB NOT NULL DEFAULT '[]',
  values JSONB NOT NULL DEFAULT '[]', red_flags JSONB NOT NULL DEFAULT '[]',
  weekly_pace SMALLINT CHECK (weekly_pace IS NULL OR weekly_pace BETWEEN 0 AND 50),
  default_follow_up_days SMALLINT NOT NULL DEFAULT 7 CHECK (default_follow_up_days BETWEEN 1 AND 60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL, provider TEXT NOT NULL, messages JSONB NOT NULL DEFAULT '[]', context JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS provider_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('openai','anthropic','google','ollama')),
  encrypted_api_key TEXT, key_hint TEXT, base_url TEXT, selected_model TEXT, available_models JSONB NOT NULL DEFAULT '[]',
  active BOOLEAN NOT NULL DEFAULT false, last_checked_at TIMESTAMPTZ, last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);
CREATE INDEX IF NOT EXISTS jobs_user_idx ON jobs(user_id, started_on DESC);
CREATE INDEX IF NOT EXISTS contacts_user_idx ON contacts(user_id);
CREATE INDEX IF NOT EXISTS conversations_context_gin ON ai_conversations USING GIN(context);
CREATE INDEX IF NOT EXISTS provider_connections_user_idx ON provider_connections(user_id, active);
CREATE INDEX IF NOT EXISTS document_generation_jobs_queue_idx ON document_generation_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS document_generation_jobs_user_idx ON document_generation_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS applications_user_status_created_idx ON applications(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS applications_user_archived_idx ON applications(user_id, archived_at);
CREATE INDEX IF NOT EXISTS application_events_user_app_time_idx ON application_events(user_id, application_id, occurred_at DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS application_contacts_user_app_idx ON application_contacts(user_id, application_id);
CREATE INDEX IF NOT EXISTS application_documents_user_app_idx ON application_documents(user_id, application_id);
CREATE INDEX IF NOT EXISTS application_interviews_user_scheduled_idx ON application_interviews(user_id, scheduled_at);
CREATE INDEX IF NOT EXISTS application_scores_user_app_created_idx ON application_scores(user_id, application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS application_outcomes_user_app_created_idx ON application_outcomes(user_id, application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS application_answer_library_user_updated_idx ON application_answer_library(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS application_answers_user_app_position_idx ON application_answers(user_id, application_id, position);
CREATE INDEX IF NOT EXISTS application_answers_library_idx ON application_answers(library_answer_id);
CREATE INDEX IF NOT EXISTS command_sessions_user_status_created_idx ON command_sessions(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS command_session_actions_user_session_position_idx ON command_session_actions(user_id, command_session_id, position);
ALTER TABLE skills ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other';

-- Feature 3: Follow-up Campaigns & Email Integration
CREATE TABLE IF NOT EXISTS email_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('gmail','icloud','yahoo','outlook','smtp')),
  email TEXT NOT NULL,
  encrypted_access_token TEXT,
  encrypted_refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  smtp_host TEXT, smtp_port INTEGER,
  smtp_username TEXT, encrypted_smtp_password TEXT,
  sender_name TEXT, active BOOLEAN NOT NULL DEFAULT false,
  last_sync_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

CREATE TABLE IF NOT EXISTS follow_up_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, description TEXT,
  trigger_event TEXT NOT NULL CHECK (trigger_event IN ('applied','interview','no_response','follow_up')),
  delay_days INTEGER NOT NULL DEFAULT 7,
  subject_template TEXT NOT NULL, body_template TEXT NOT NULL,
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS application_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  sequence_number SMALLINT NOT NULL DEFAULT 1,
  follow_up_type TEXT NOT NULL CHECK (follow_up_type IN ('general_check','recruiter_follow_up','thank_you','post_interview','networking','negotiation','re_engagement')),
  subject TEXT, message TEXT,
  recipient_email TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sent','skipped','failed')),
  scheduled_for TIMESTAMPTZ, sent_at TIMESTAMPTZ,
  delivery_method TEXT DEFAULT 'in_app' CHECK (delivery_method IN ('in_app','email','both')),
  email_connection_id UUID REFERENCES email_connections(id) ON DELETE SET NULL,
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  opened_at TIMESTAMPTZ, replied_at TIMESTAMPTZ, notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS application_follow_ups_app_idx ON application_follow_ups(user_id, application_id, scheduled_for);
CREATE INDEX IF NOT EXISTS application_follow_ups_due_idx ON application_follow_ups(user_id, status, scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS follow_up_templates_user_tigger_idx ON follow_up_templates(user_id, trigger_event, active);
CREATE INDEX IF NOT EXISTS email_connections_user_active_idx ON email_connections(user_id, active);

-- Feature 5: Personal Branding Studio
CREATE TABLE IF NOT EXISTS brand_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  linkedin_headline TEXT,
  linkedin_about TEXT,
  linkedin_experience JSONB NOT NULL DEFAULT '[]',
  github_bio TEXT,
  github_pinned JSONB NOT NULL DEFAULT '[]',
  portfolio_bio TEXT,
  personal_statement TEXT,
  brand_keywords JSONB NOT NULL DEFAULT '[]',
  consistency_score SMALLINT DEFAULT 0,
  last_scored_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
