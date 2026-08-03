-- Venue / listing submissions from /submit and homepage modal.
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'new',
  submission_type TEXT NOT NULL DEFAULT 'new_listing',
  name TEXT NOT NULL,
  town TEXT NOT NULL,
  state TEXT,
  address TEXT,
  category TEXT,
  happy_hour_schedule TEXT,
  deals TEXT,
  vibe TEXT,
  contact_name TEXT,
  role TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  has_patio TEXT,
  notes TEXT,
  source TEXT,
  path TEXT,
  referrer TEXT,
  visitor_id TEXT,
  user_agent TEXT,
  country TEXT,
  city TEXT,
  region TEXT,
  colo TEXT,
  payload TEXT
);

CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_email ON submissions(email);
CREATE INDEX IF NOT EXISTS idx_submissions_name ON submissions(name);
