-- Stripe subscription fields for Featured listings.
ALTER TABLE venues ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE venues ADD COLUMN stripe_subscription_id TEXT;
