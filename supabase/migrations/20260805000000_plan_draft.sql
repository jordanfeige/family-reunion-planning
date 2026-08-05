-- Anonymous planning drafts (7-day TTL). Claimed → real trip with owner.
-- Idempotent: safe to re-run in the Supabase SQL editor.

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

-- In case a partial create left the table incomplete:
ALTER TABLE plan_draft ADD COLUMN IF NOT EXISTS secret text;
ALTER TABLE plan_draft ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE plan_draft ADD COLUMN IF NOT EXISTS message_count integer NOT NULL DEFAULT 0;
ALTER TABLE plan_draft ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE plan_draft ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE plan_draft ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
ALTER TABLE plan_draft ADD COLUMN IF NOT EXISTS claimed_trip_id text;

-- Backfill expires_at if somehow null on existing rows
UPDATE plan_draft
SET expires_at = created_at + interval '7 days'
WHERE expires_at IS NULL;

ALTER TABLE plan_draft ALTER COLUMN expires_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS plan_draft_secret_key ON plan_draft(secret);
CREATE INDEX IF NOT EXISTS idx_plan_draft_secret ON plan_draft(secret);
CREATE INDEX IF NOT EXISTS idx_plan_draft_expires ON plan_draft(expires_at);

ALTER TABLE plan_draft ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_draft_service_all ON plan_draft;
CREATE POLICY plan_draft_service_all ON plan_draft
  FOR ALL TO service_role USING (true) WITH CHECK (true);
