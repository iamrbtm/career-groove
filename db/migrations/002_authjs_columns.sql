DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='email_verified') THEN
    ALTER TABLE users RENAME COLUMN email_verified TO "emailVerified";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='user_id') THEN
    ALTER TABLE accounts RENAME COLUMN user_id TO "userId";
    ALTER TABLE accounts RENAME COLUMN provider_account_id TO "providerAccountId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sessions' AND column_name='session_token') THEN
    ALTER TABLE sessions RENAME COLUMN session_token TO "sessionToken";
    ALTER TABLE sessions RENAME COLUMN user_id TO "userId";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sessions' AND column_name='id') THEN
    ALTER TABLE sessions ADD COLUMN id UUID DEFAULT gen_random_uuid() NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='authenticators' AND column_name='credential_id') THEN
    ALTER TABLE authenticators RENAME COLUMN credential_id TO "credentialID";
    ALTER TABLE authenticators RENAME COLUMN user_id TO "userId";
    ALTER TABLE authenticators RENAME COLUMN provider_account_id TO "providerAccountId";
    ALTER TABLE authenticators RENAME COLUMN credential_public_key TO "credentialPublicKey";
    ALTER TABLE authenticators RENAME COLUMN credential_device_type TO "credentialDeviceType";
    ALTER TABLE authenticators RENAME COLUMN credential_backed_up TO "credentialBackedUp";
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS verification_token (
  identifier TEXT NOT NULL, token TEXT NOT NULL, expires TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(identifier, token)
);
