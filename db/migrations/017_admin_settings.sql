CREATE TABLE IF NOT EXISTS admins (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO settings (key, value) VALUES ('premium_ai_config', '{"provider":"openai","model":"gpt-4o-mini","api_key":"","base_url":null}')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value) VALUES ('stripe_config', '{"price_monthly":"","price_yearly":"","price_lifetime":"","publishable_key":""}')
ON CONFLICT (key) DO NOTHING;
