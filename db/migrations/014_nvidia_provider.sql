-- Widens the provider_connection provider check to include nvidia.
-- Safe to re-run: only applies when the installed constraint does not
-- already mention nvidia (bump to ensure later kilo state is preserved).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'provider_connections_provider_check'
      AND pg_get_constraintdef(oid) ILIKE '%nvidia%'
  ) THEN
    ALTER TABLE provider_connections DROP CONSTRAINT IF EXISTS provider_connections_provider_check;
    ALTER TABLE provider_connections ADD CONSTRAINT provider_connections_provider_check
      CHECK (provider IN ('openai','anthropic','google','ollama','nvidia'));
  END IF;
END $$;
