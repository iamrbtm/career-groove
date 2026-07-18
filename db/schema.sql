CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT, email TEXT UNIQUE NOT NULL,
  "emailVerified" TIMESTAMPTZ, image TEXT, password_hash TEXT, preferences JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
ALTER TABLE skills ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other';
