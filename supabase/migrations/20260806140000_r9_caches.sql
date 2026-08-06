-- R9: lodging / place / drive / area caches
-- Soft-applied; app soft-fails if tables missing.

create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  query_key text not null unique,
  label text not null,
  lat double precision not null,
  lng double precision not null,
  country text,
  region text,
  created_at timestamptz not null default now()
);

create table if not exists public.lodging_cache (
  cache_key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists lodging_cache_expires_idx
  on public.lodging_cache (expires_at);

create table if not exists public.place_cache (
  cache_key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists public.drive_cache (
  pair_key text primary key,
  minutes integer not null,
  meters double precision,
  created_at timestamptz not null default now()
);
