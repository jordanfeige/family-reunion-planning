-- Shared trip budget: expenses and household contributions (amounts in cents).

create table if not exists trip_expense (
  id text primary key default gen_random_uuid()::text,
  trip_id text not null references trip(id) on delete cascade,
  title text not null,
  category text not null check (category in ('lodging', 'food', 'activity', 'travel', 'other')),
  amount_cents integer not null check (amount_cents >= 0),
  split_method text not null default 'even_per_household'
    check (split_method in ('even_per_household', 'per_person', 'custom')),
  paid_by_name text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_trip_expense_trip_id on trip_expense(trip_id);

create table if not exists trip_contribution (
  id text primary key default gen_random_uuid()::text,
  trip_id text not null references trip(id) on delete cascade,
  household_name text not null,
  household_email text,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid')),
  method text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, household_name)
);

create index if not exists idx_trip_contribution_trip_id on trip_contribution(trip_id);

alter table trip_expense enable row level security;
alter table trip_contribution enable row level security;

create policy trip_expense_service_all on trip_expense
  for all to service_role using (true) with check (true);

create policy trip_contribution_service_all on trip_contribution
  for all to service_role using (true) with check (true);
