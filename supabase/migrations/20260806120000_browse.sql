-- Browse swipes + soft people facts (R8 / R6 bridge)
CREATE TABLE IF NOT EXISTS browse_swipes (
  id text PRIMARY KEY,
  user_id text REFERENCES "user"(id) ON DELETE CASCADE,
  anon_key text,
  idea_title text NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  direction text NOT NULL CHECK (direction IN ('keep', 'skip')),
  prompt_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS browse_swipes_user_idx ON browse_swipes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS browse_swipes_anon_idx ON browse_swipes (anon_key, created_at DESC);

CREATE TABLE IF NOT EXISTS person_facts (
  id text PRIMARY KEY,
  user_id text REFERENCES "user"(id) ON DELETE CASCADE,
  anon_key text,
  kind text NOT NULL CHECK (kind IN ('preference', 'dislike')),
  value text NOT NULL,
  confidence text NOT NULL CHECK (confidence IN ('inferred', 'confirmed')),
  source_quote text NOT NULL,
  retired boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS person_facts_user_idx ON person_facts (user_id, created_at DESC);
