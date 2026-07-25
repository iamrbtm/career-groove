ALTER TABLE users ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "stripePriceId" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "stripeCurrentPeriodEnd" TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_customer_id_idx
  ON users ("stripeCustomerId") WHERE "stripeCustomerId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_subscription_id_idx
  ON users ("stripeSubscriptionId") WHERE "stripeSubscriptionId" IS NOT NULL;
