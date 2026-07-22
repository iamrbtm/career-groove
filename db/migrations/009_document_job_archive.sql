ALTER TABLE document_generation_jobs ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
