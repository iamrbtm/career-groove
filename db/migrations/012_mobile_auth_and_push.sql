CREATE TABLE IF NOT EXISTS mobile_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token_hash TEXT NOT NULL UNIQUE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  previous_refresh_token_hash TEXT UNIQUE,
  access_expires_at TIMESTAMPTZ NOT NULL,
  refresh_expires_at TIMESTAMPTZ NOT NULL,
  device_name TEXT,
  platform TEXT NOT NULL DEFAULT 'ios',
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mobile_sessions_user_active_idx
  ON mobile_sessions(user_id, refresh_expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS mobile_oauth_codes (
  code_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_challenge TEXT NOT NULL,
  state_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mobile_oauth_codes_expiry_idx ON mobile_oauth_codes(expires_at);

CREATE TABLE IF NOT EXISTS mobile_passkey_challenges (
  request_id_hash TEXT PRIMARY KEY,
  challenge_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mobile_passkey_challenges_expiry_idx ON mobile_passkey_challenges(expires_at);

CREATE TABLE IF NOT EXISTS mobile_identity_assertions (
  assertion_id TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mobile_auth_attempts (
  identifier_hash TEXT NOT NULL,
  network_hash TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mobile_auth_attempts_lookup_idx
  ON mobile_auth_attempts(identifier_hash, network_hash, attempted_at DESC);

CREATE TABLE IF NOT EXISTS push_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  device_token TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('sandbox','production')),
  enabled_categories JSONB NOT NULL DEFAULT '[]',
  app_version TEXT,
  locale TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_devices_user_idx ON push_devices(user_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS mobile_notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES push_devices(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sending' CHECK (status IN ('sending','sent','failed')),
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(device_id, source_key)
);

CREATE INDEX IF NOT EXISTS mobile_notification_deliveries_created_idx
  ON mobile_notification_deliveries(created_at);

ALTER TABLE users ADD COLUMN IF NOT EXISTS "appStoreOriginalTransactionId" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "appStoreProductId" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "appStoreEnvironment" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "appStoreExpiresAt" TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS users_app_store_original_transaction_idx
  ON users("appStoreOriginalTransactionId")
  WHERE "appStoreOriginalTransactionId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS app_store_notifications (
  notification_id TEXT PRIMARY KEY,
  notification_type TEXT,
  environment TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
