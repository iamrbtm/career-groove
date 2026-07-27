ALTER TABLE application_outcomes
  ADD COLUMN IF NOT EXISTS role_fit TEXT CHECK (role_fit IN ('stretch','fit','mismatch','unclear')),
  ADD COLUMN IF NOT EXISTS similar_strategy TEXT CHECK (similar_strategy IN ('prioritize','deprioritize','neutral'));
CREATE INDEX IF NOT EXISTS application_outcomes_role_fit_idx ON application_outcomes(user_id, role_fit);
CREATE INDEX IF NOT EXISTS application_outcomes_similar_strategy_idx ON application_outcomes(user_id, similar_strategy);
