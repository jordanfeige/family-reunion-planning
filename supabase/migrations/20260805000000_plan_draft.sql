-- Anonymous planning drafts (7-day TTL). Claimed → real trip with owner.
CREATE TABLE IF NOT EXISTS plan_draft (
  id text PRIMARY KEY,
  secret text NOT NULL UNIQUE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  message_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  claimed_at timestamptz,
  claimed_trip_id text
);

CREATE INDEX IF NOT EXISTS idx_plan_draft_secret ON plan_draft(secret);
CREATE INDEX IF NOT EXISTS idx_plan_draft_expires ON plan_draft(expires_at);

ALTER TABLE plan_draft ENABLE ROW LEVEL SECURITY;

CREATE POLICY plan_draft_service_all ON plan_draft
  FOR ALL TO service_role USING (true) WITH CHECK (true);
