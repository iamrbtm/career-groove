ALTER TABLE provider_connections DROP CONSTRAINT IF EXISTS provider_connections_provider_check;
ALTER TABLE provider_connections ADD CONSTRAINT provider_connections_provider_check CHECK (provider IN ('openai','anthropic','google','ollama','nvidia'));
