-- Claimed / verified owner listings (separate from paid Featured placement).
ALTER TABLE venues ADD COLUMN claimed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE venues ADD COLUMN claimed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_venues_claimed ON venues(claimed);
