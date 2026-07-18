ALTER TABLE contacts ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS phone TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS contacts_user_job_name_idx
  ON contacts(user_id,job_id,lower(name)) WHERE job_id IS NOT NULL;
