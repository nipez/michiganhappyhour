-- Per-venue unguessable token for shareable claim-outreach traffic pages.
-- Generate/rotate from admin; public page looks up by token only (no id/slug enumeration).
ALTER TABLE venues ADD COLUMN outreach_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_venues_outreach_token
  ON venues(outreach_token)
  WHERE outreach_token IS NOT NULL;
