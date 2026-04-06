-- Run in Supabase SQL Editor if `worker_profiles` already exists without these columns.

alter table worker_profiles add column if not exists date_of_birth date;
alter table worker_profiles add column if not exists no_physical_injuries boolean default false;
alter table worker_profiles add column if not exists bio text;
alter table worker_profiles add column if not exists emergency_contact_name text;
alter table worker_profiles add column if not exists emergency_contact_phone text;
