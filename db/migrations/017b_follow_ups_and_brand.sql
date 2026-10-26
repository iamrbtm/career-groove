-- Feature 3: Follow-up Campaigns & Email Integration
CREATE TABLE IF NOT EXISTS email_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('gmail','outlook','smtp')),
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
