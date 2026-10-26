-- Widens the provider_connection provider check to include kilo.
-- Safe to re-run: only applies when the installed constraint does not
-- already allow kilo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'provider_connections_provider_check'
      AND pg_get_constraintdef(oid) ILIKE '%kilo%'
  ) THEN
    ALTER TABLE provider_connections DROP CONSTRAINT IF EXISTS provider_connections_provider_check;
    ALTER TABLE provider_connections ADD CONSTRAINT provider_connections_provider_check
      CHECK (provider IN ('openai','anthropic','google','ollama','nvidia','kilo'));
  END IF;
END $$;
