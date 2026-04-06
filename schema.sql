-- OCAP database schema + seed (run in Supabase SQL editor or psql)
-- PostGIS must be enabled under Database > Extensions in Supabase dashboard if this fails.

-- Enable PostGIS
create extension if not exists postgis;

-- Users (id = Clerk user id, e.g. user_2abc...)
create table users (
  id text primary key,
  role text check (role in ('worker', 'hirer')) not null,
  name text,
  phone text unique,
  avatar_url text,
  created_at timestamptz default now()
);

-- Worker Profiles
create table worker_profiles (
  id text primary key references users(id),
  skills text[],
  hourly_rate numeric,
  experience_years int,
  is_available boolean default true,
  rating numeric default 0,
  date_of_birth date,
  no_physical_injuries boolean default false,
  bio text,
  emergency_contact_name text,
  emergency_contact_phone text
);

-- Job Postings
create table job_postings (
  id uuid primary key default gen_random_uuid(),
  hirer_id text references users(id),
  title text not null,
  description text,
  location geography(Point, 4326),
  address text,
  hourly_rate numeric,
  is_fixed_rate boolean default false,
  fixed_rate numeric,
  personnel_count int,
  daily_hours numeric,
  start_date date,
  shift_start time,
  is_urgent boolean default false,
  status text check (status in ('active','filled','closed')) default 'active',
  created_at timestamptz default now()
);

-- Applications
create table applications (
  id uuid primary key default gen_random_uuid(),
  worker_id text references users(id),
  job_id uuid references job_postings(id),
  status text check (status in ('pending','accepted','rejected')) default 'pending',
  created_at timestamptz default now(),
  unique (job_id, worker_id)
);

-- Worker live location (for hirer tracking screen)
create table worker_locations (
  worker_id text primary key references users(id),
  lat double precision not null,
  lng double precision not null,
  updated_at timestamptz default now()
);

-- If you enable RLS on `applications`, add e.g.:
--   CREATE POLICY "workers insert own application" ON applications FOR INSERT
--     WITH CHECK (worker_id = auth.uid()::text);
--   (Use anon/service role in dev if policies are not set yet.)

-- RLS: anonymous read for active gigs + hirer display names
alter table job_postings enable row level security;
alter table users enable row level security;

create policy "job_postings_select_active"
  on job_postings for select
  using (status = 'active');

create policy "users_select_hirers"
  on users for select
  using (role = 'hirer');

-- Seed hirers (stable UUIDs for reproducible joins)
insert into users (id, role, name, phone, avatar_url) values
  ('10000000-0000-4000-8000-000000000001', 'hirer', 'Khanna Constructions', '+919100000001', null),
  ('10000000-0000-4000-8000-000000000002', 'hirer', 'Metro Rail Proj.', '+919100000002', null),
  ('10000000-0000-4000-8000-000000000003', 'hirer', 'Larsen & Toubro Const.', '+919100000003', null);

-- Seed jobs (locations ~2.3km / 5.1km / 1.2km from Rohini reference: 28.7075°N, 77.1025°E)
insert into job_postings (
  id,
  hirer_id,
  title,
  description,
  location,
  address,
  hourly_rate,
  is_fixed_rate,
  fixed_rate,
  personnel_count,
  daily_hours,
  start_date,
  shift_start,
  is_urgent,
  status,
  created_at
) values
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'Mason needed – Rohini Site',
    'Standard masonry work at Rohini site.',
    ST_SetSRID(ST_MakePoint(77.1025, 28.7282), 4326)::geography,
    'Rohini Site, Delhi',
    180,
    false,
    null,
    1,
    8,
    current_date,
    '09:00:00',
    false,
    'active',
    now() - interval '2 days'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    'Heavy lifting team (4 pos)',
    'Night shift',
    ST_SetSRID(ST_MakePoint(77.1025, 28.7534), 4326)::geography,
    'Night route, Delhi NCR',
    null,
    true,
    1200,
    4,
    8,
    current_date,
    '22:00:00',
    true,
    'active',
    now() - interval '1 day'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000003',
    'Lead bricklayer / mason',
    'Duration: 5 days',
    ST_SetSRID(ST_MakePoint(77.1148, 28.7075), 4326)::geography,
    'Mumbai MH vicinity (demo coords)',
    450,
    false,
    null,
    1,
    8,
    current_date,
    '08:00:00',
    true,
    'active',
    now()
  );
