CREATE TABLE IF NOT EXISTS provider_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('openai','anthropic','google','ollama')),
  encrypted_api_key TEXT, key_hint TEXT, base_url TEXT, selected_model TEXT, available_models JSONB NOT NULL DEFAULT '[]',
  active BOOLEAN NOT NULL DEFAULT false, last_checked_at TIMESTAMPTZ, last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);
CREATE INDEX IF NOT EXISTS provider_connections_user_idx ON provider_connections(user_id, active);
ALTER TABLE provider_connections ADD COLUMN IF NOT EXISTS base_url TEXT;
