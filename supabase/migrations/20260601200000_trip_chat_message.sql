-- Persisted WandrAI planner chat threads (locations, venues, per-day itinerary).
-- Apply with: npm run db:push (requires DATABASE_URL / linked Supabase).

create table if not exists trip_chat_message (
  id text primary key default gen_random_uuid()::text,
  trip_id text not null references trip(id) on delete cascade,
  mode text not null check (mode in ('locations', 'venues', 'itinerary')),
  focus_day text,
  message_id text not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  parts jsonb not null default '[]'::jsonb,
  sort_index integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_trip_chat_message_thread
  on trip_chat_message (trip_id, mode, focus_day, sort_index, created_at);

-- Nullable focus_day: use coalesce so locations/venues threads dedupe correctly.
create unique index if not exists trip_chat_message_thread_message_unique
  on trip_chat_message (trip_id, mode, (coalesce(focus_day, '')), message_id);

alter table trip_chat_message enable row level security;

create policy trip_chat_message_service_all on trip_chat_message
  for all to service_role using (true) with check (true);
