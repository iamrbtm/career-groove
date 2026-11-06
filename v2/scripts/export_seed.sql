WITH kept_users AS (
  SELECT id, name, email, "emailVerified", image, password_hash, preferences, created_at
  FROM users
  WHERE email IN ('rbtm2006@me.com', 'rbtm2006@icloud.com')
),
kept_jobs AS (
  SELECT j.* FROM jobs j JOIN kept_users u ON u.id = j.user_id
),
kept_skills AS (
  SELECT s.* FROM skills s JOIN kept_users u ON u.id = s.user_id
)
SELECT jsonb_pretty(jsonb_build_object(
  'users', (
    SELECT json_agg(json_build_object(
      'id', id,
      'name', name,
      'email', email,
      'emailVerified', "emailVerified",
      'image', image,
      'passwordHash', password_hash,
      'preferences', preferences,
      'createdAt', created_at
    )) FROM kept_users
  ),
  'jobs', (
    SELECT json_agg(json_build_object(
      'id', id,
      'userId', user_id,
      'company', company,
      'title', title,
      'location', location,
      'startedOn', started_on,
      'endedOn', ended_on,
      'current', current,
      'description', raw_notes,
      'highlights', achievements,
      'metadata', metadata
    )) FROM kept_jobs
  ),
  'residences', (
    SELECT json_agg(json_build_object(
      'id', id,
      'userId', user_id,
      'label', label,
      'address', address,
      'startedOn', started_on,
      'endedOn', ended_on,
      'metadata', metadata
    )) FROM residences WHERE user_id IN (SELECT id FROM kept_users)
  ),
  'credentials', (
    SELECT json_agg(json_build_object(
      'id', id,
      'userId', user_id,
      'kind', kind,
      'name', name,
      'issuer', issuer,
      'issuedOn', issued_on,
      'expiresOn', expires_on,
      'details', details
    )) FROM credentials WHERE user_id IN (SELECT id FROM kept_users)
  ),
  'skills', (
    SELECT json_agg(json_build_object(
      'id', id,
      'userId', user_id,
      'name', name,
      'proficiency', proficiency,
      'category', category
    )) FROM kept_skills
  ),
  'jobSkills', (
    SELECT json_agg(json_build_object('jobId', job_id, 'skillId', skill_id))
    FROM job_skills
    WHERE job_id IN (SELECT id FROM kept_jobs)
      AND skill_id IN (SELECT id FROM kept_skills)
  )
));
