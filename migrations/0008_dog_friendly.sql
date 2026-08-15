-- Dog-friendly venue flag (1 = yes, 0 = not marked).
ALTER TABLE venues ADD COLUMN dog_friendly INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_venues_dog_friendly ON venues(dog_friendly);

-- Tip / claim form checkbox storage
ALTER TABLE submissions ADD COLUMN has_dog TEXT;
