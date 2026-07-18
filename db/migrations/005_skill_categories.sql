ALTER TABLE skills ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'skills_category_check'
  ) THEN
    ALTER TABLE skills ADD CONSTRAINT skills_category_check CHECK (
      category IN (
        'interpersonal_behavioral',
        'cognitive_methodological',
        'technical_digital',
        'business_operational',
        'specialized_vocational',
        'other'
      )
    );
  END IF;
END $$;
