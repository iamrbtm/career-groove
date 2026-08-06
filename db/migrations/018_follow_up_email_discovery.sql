-- Migration 018: Follow-up email discovery
-- Adds recipient_email to application_follow_ups so discovered/selected
-- addresses survive across requests without re-running discovery.
-- Also widens the email_connections provider check to include icloud and yahoo.

ALTER TABLE application_follow_ups
  ADD COLUMN IF NOT EXISTS recipient_email TEXT;

ALTER TABLE email_connections
  DROP CONSTRAINT IF EXISTS email_connections_provider_check;

ALTER TABLE email_connections
  ADD CONSTRAINT email_connections_provider_check
    CHECK (provider IN ('gmail', 'icloud', 'yahoo', 'outlook', 'smtp'));
