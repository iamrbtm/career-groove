-- Migration 022: follow-up reminder dedupe (reminded_at + partial index)
ALTER TABLE application_follow_ups ADD COLUMN IF NOT EXISTS reminded_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS follow_ups_reminder_idx ON application_follow_ups (status) WHERE status IN ('draft', 'scheduled');
