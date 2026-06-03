-- Link family survey / RSVP / ballot rows to signed-in users (nullable; anonymous flow unchanged).

alter table survey_response
  add column if not exists user_id text references "user"(id) on delete set null;

create unique index if not exists survey_response_survey_user_unique
  on survey_response (survey_id, user_id)
  where user_id is not null;

alter table trip_confirmation
  add column if not exists user_id text references "user"(id) on delete set null;

create unique index if not exists trip_confirmation_trip_user_unique
  on trip_confirmation (trip_id, user_id)
  where user_id is not null;

alter table trip_ballot_vote
  add column if not exists user_id text references "user"(id) on delete set null;

create index if not exists idx_trip_ballot_vote_user_id on trip_ballot_vote(trip_id, user_id)
  where user_id is not null;
