-- Provenance + enrichment fields for automatic / bulk venue imports.
ALTER TABLE venues ADD COLUMN website TEXT;
ALTER TABLE venues ADD COLUMN source TEXT NOT NULL DEFAULT 'curated';
ALTER TABLE venues ADD COLUMN external_id TEXT;
ALTER TABLE venues ADD COLUMN last_verified_at TEXT;

-- SQLite allows multiple NULLs in a UNIQUE index (curated rows stay NULL).
CREATE UNIQUE INDEX IF NOT EXISTS idx_venues_external_id ON venues(external_id);
CREATE INDEX IF NOT EXISTS idx_venues_source ON venues(source);
