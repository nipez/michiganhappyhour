-- Speed month-bounded venue traffic aggregations (claimed listing reports).
-- Query pattern: WHERE created_at >= ? AND created_at < ? AND event_name IN (...)
CREATE INDEX IF NOT EXISTS idx_events_created_at_event_name
  ON events(created_at, event_name);
