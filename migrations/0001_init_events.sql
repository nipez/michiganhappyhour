-- Raw event log for venue KPIs and product analytics (test-friendly, high fidelity).
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  event_name TEXT NOT NULL,
  spot_id TEXT,
  spot_name TEXT,
  town TEXT,
  page_type TEXT,
  source TEXT,
  path TEXT,
  title TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  visitor_id TEXT,
  session_id TEXT,
  language TEXT,
  timezone TEXT,
  screen_w INTEGER,
  screen_h INTEGER,
  viewport_w INTEGER,
  viewport_h INTEGER,
  user_agent TEXT,
  country TEXT,
  city TEXT,
  region TEXT,
  colo TEXT,
  payload TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_event_name ON events(event_name);
CREATE INDEX IF NOT EXISTS idx_events_spot_name ON events(spot_name);
CREATE INDEX IF NOT EXISTS idx_events_spot_id ON events(spot_id);
CREATE INDEX IF NOT EXISTS idx_events_visitor_id ON events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_events_town ON events(town);
CREATE INDEX IF NOT EXISTS idx_events_name_spot_created ON events(event_name, spot_name, created_at);
