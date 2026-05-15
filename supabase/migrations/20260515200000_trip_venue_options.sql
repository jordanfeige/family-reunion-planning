-- Organizer shortlist: places to stay, eat, and gather (no family survey).
alter table trip
  add column if not exists venue_options jsonb not null default '[]'::jsonb,
  add column if not exists selected_venue_id text;
