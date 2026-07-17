CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT, email TEXT UNIQUE NOT NULL,
  email_verified TIMESTAMPTZ, image TEXT, password_hash TEXT, preferences JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, provider TEXT NOT NULL, provider_account_id TEXT NOT NULL, refresh_token TEXT,
  access_token TEXT, expires_at BIGINT, token_type TEXT, scope TEXT, id_token TEXT, session_state TEXT,
  UNIQUE(provider, provider_account_id)
);
CREATE TABLE IF NOT EXISTS sessions (
  session_token TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL, token TEXT NOT NULL, expires TIMESTAMPTZ NOT NULL, PRIMARY KEY(identifier, token)
);
CREATE TABLE IF NOT EXISTS authenticators (
  credential_id TEXT NOT NULL UNIQUE, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_account_id TEXT NOT NULL, credential_public_key TEXT NOT NULL, counter INTEGER NOT NULL,
  credential_device_type TEXT NOT NULL, credential_backed_up BOOLEAN NOT NULL, transports TEXT,
  PRIMARY KEY(user_id, credential_id)
);
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company TEXT NOT NULL, title TEXT NOT NULL, location TEXT, started_on DATE, ended_on DATE, current BOOLEAN DEFAULT false,
  raw_notes TEXT, achievements JSONB NOT NULL DEFAULT '[]', metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, company TEXT, role TEXT, email TEXT, relationship_strength SMALLINT DEFAULT 1,
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
CREATE INDEX IF NOT EXISTS jobs_user_idx ON jobs(user_id, started_on DESC);
CREATE INDEX IF NOT EXISTS contacts_user_idx ON contacts(user_id);
CREATE INDEX IF NOT EXISTS conversations_context_gin ON ai_conversations USING GIN(context);
