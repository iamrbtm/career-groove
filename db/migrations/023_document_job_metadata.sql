ALTER TABLE document_generation_jobs ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
