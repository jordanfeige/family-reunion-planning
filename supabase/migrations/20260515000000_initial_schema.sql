-- WandrAI app schema (matches src/db/schema.ts)
-- Auth.js tables are managed separately via Drizzle; app tables use Supabase client.

CREATE TABLE IF NOT EXISTS trip (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  tagline text,
  destination_notes text,
  target_budget text,
  trip_start timestamptz,
  trip_end timestamptz,
  proposed_date_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  location_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected_location_id text,
  selected_weekend_friday text,
  plan_headcount integer,
  itinerary jsonb NOT NULL DEFAULT '{"days":[]}'::jsonb,
  published_itinerary jsonb,
  share_options_token text NOT NULL UNIQUE,
  owner_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS survey (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  trip_id text NOT NULL UNIQUE REFERENCES trip(id) ON DELETE CASCADE,
  public_token text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT 'When can your crew join?',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS survey_response (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  survey_id text NOT NULL REFERENCES survey(id) ON DELETE CASCADE,
  respondent_name text NOT NULL,
  respondent_email text,
  selected_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected_locations jsonb NOT NULL DEFAULT '[]'::jsonb,
  adult_count integer NOT NULL DEFAULT 1,
  kid_count integer NOT NULL DEFAULT 0,
  attendee_count integer NOT NULL DEFAULT 1,
  notes text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trip_confirmation (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  trip_id text NOT NULL REFERENCES trip(id) ON DELETE CASCADE,
  respondent_name text NOT NULL,
  respondent_email text,
  status text NOT NULL CHECK (status IN ('confirmed', 'declined')),
  adult_count integer NOT NULL DEFAULT 0,
  kid_count integer NOT NULL DEFAULT 0,
  weekend_friday text NOT NULL,
  location_id text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trip_option (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  trip_id text NOT NULL REFERENCES trip(id) ON DELETE CASCADE,
  title text NOT NULL,
  summary text,
  content_markdown text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gallery_item (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  trip_id text NOT NULL REFERENCES trip(id) ON DELETE CASCADE,
  url text NOT NULL,
  media_type text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trip_owner_id ON trip(owner_id);
CREATE INDEX IF NOT EXISTS idx_trip_slug ON trip(slug);
CREATE INDEX IF NOT EXISTS idx_survey_public_token ON survey(public_token);
CREATE INDEX IF NOT EXISTS idx_survey_response_survey_id ON survey_response(survey_id);
CREATE INDEX IF NOT EXISTS idx_trip_confirmation_trip_id ON trip_confirmation(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_option_trip_id ON trip_option(trip_id);
CREATE INDEX IF NOT EXISTS idx_gallery_item_trip_id ON gallery_item(trip_id);

ALTER TABLE trip ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_response ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_confirmation ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_option ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_item ENABLE ROW LEVEL SECURITY;

-- Server-side access uses the service role (bypasses RLS). Browser uses anon + policies below.

CREATE POLICY trip_service_all ON trip FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY survey_service_all ON survey FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY survey_response_service_all ON survey_response FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY trip_confirmation_service_all ON trip_confirmation FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY trip_option_service_all ON trip_option FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY gallery_item_service_all ON gallery_item FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Public read for shared plan pages (anon key from browser if needed later)
CREATE POLICY trip_public_read_by_share_token ON trip FOR SELECT TO anon
  USING (true);

CREATE POLICY survey_public_read ON survey FOR SELECT TO anon USING (true);
CREATE POLICY survey_response_public_insert ON survey_response FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY trip_confirmation_public_all ON trip_confirmation FOR ALL TO anon USING (true) WITH CHECK (true);
