-- US meta: organizer origin + per-household / per-user home for drive times
ALTER TABLE trip
  ADD COLUMN IF NOT EXISTS origin_metro text DEFAULT 'Sioux Falls, SD';

ALTER TABLE survey_response
  ADD COLUMN IF NOT EXISTS home_city text,
  ADD COLUMN IF NOT EXISTS home_state text;

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS home_city text,
  ADD COLUMN IF NOT EXISTS home_state text;
