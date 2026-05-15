CREATE TABLE IF NOT EXISTS trip_member (
  id text PRIMARY KEY,
  trip_id text NOT NULL REFERENCES trip(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'editor',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, user_id)
);

CREATE TABLE IF NOT EXISTS trip_invite (
  id text PRIMARY KEY,
  trip_id text NOT NULL REFERENCES trip(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by_user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, email)
);

CREATE INDEX IF NOT EXISTS idx_trip_member_user_id ON trip_member(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_member_trip_id ON trip_member(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_invite_email ON trip_invite(email);
CREATE INDEX IF NOT EXISTS idx_trip_invite_trip_id ON trip_invite(trip_id);

ALTER TABLE trip_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_invite ENABLE ROW LEVEL SECURITY;

CREATE POLICY trip_member_service_all ON trip_member FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY trip_invite_service_all ON trip_invite FOR ALL TO service_role USING (true) WITH CHECK (true);
