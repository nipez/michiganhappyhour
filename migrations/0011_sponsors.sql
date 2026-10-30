-- Exclusive paid local sponsors for town and region landing pages ($100/mo).
-- One active sponsor per place_slug at a time (enforced in app reads + admin).
CREATE TABLE IF NOT EXISTS sponsors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_type TEXT NOT NULL CHECK (place_type IN ('town', 'region')),
  place_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  tagline TEXT,
  image_url TEXT,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sponsors_place
  ON sponsors(place_type, place_slug, active);

CREATE INDEX IF NOT EXISTS idx_sponsors_dates
  ON sponsors(active, starts_at, ends_at);
