-- Group ballot: family thumbs up/down on stay, eat, and do options.
alter table trip
  add column if not exists ballot_status text not null default 'draft',
  add column if not exists ballot_opened_at timestamptz,
  add column if not exists ballot_closed_at timestamptz;

create table if not exists trip_ballot_vote (
  id text primary key default gen_random_uuid()::text,
  trip_id text not null references trip(id) on delete cascade,
  option_id text not null,
  vote text not null check (vote in ('up', 'down')),
  survey_response_id text references survey_response(id) on delete set null,
  voter_name text,
  voter_email text,
  voter_key text not null,
  voted_at timestamptz not null default now(),
  unique (trip_id, option_id, voter_key)
);

create index if not exists idx_trip_ballot_vote_trip_id on trip_ballot_vote(trip_id);
create index if not exists idx_trip_ballot_vote_option_id on trip_ballot_vote(trip_id, option_id);

alter table trip_ballot_vote enable row level security;

create policy trip_ballot_vote_service_all on trip_ballot_vote
  for all to service_role using (true) with check (true);
