-- Editable venue catalog (source of truth for map + homepage listings).
CREATE TABLE IF NOT EXISTS venues (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  region TEXT NOT NULL,
  region_name TEXT,
  region_color TEXT,
  town TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  hh_start TEXT,
  hh_end TEXT,
  hh_days TEXT NOT NULL DEFAULT '[]',
  deals TEXT NOT NULL DEFAULT '[]',
  vibe TEXT,
  lat REAL,
  lng REAL,
  featured INTEGER NOT NULL DEFAULT 0,
  collections TEXT NOT NULL DEFAULT '[]',
  spot_path TEXT,
  status TEXT NOT NULL DEFAULT 'published',
  admin_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_venues_region ON venues(region);
CREATE INDEX IF NOT EXISTS idx_venues_town ON venues(town);
CREATE INDEX IF NOT EXISTS idx_venues_status ON venues(status);
CREATE INDEX IF NOT EXISTS idx_venues_name ON venues(name);
CREATE INDEX IF NOT EXISTS idx_venues_featured ON venues(featured);
