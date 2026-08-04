-- Business hours from OSM (distinct from happy-hour window fields).
ALTER TABLE venues ADD COLUMN opening_hours TEXT;
