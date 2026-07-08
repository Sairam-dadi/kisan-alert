-- Run this in your Supabase project's SQL Editor (Project → SQL Editor → New query)

create table if not exists crop_health_reports (
  id uuid primary key default gen_random_uuid(),
  farmer_email text,
  crop_identified text,
  issue text,
  severity text,
  confidence text,
  remedy text,
  reasoning text,
  escalated boolean default false,
  escalation_reason text,
  status text default 'open',
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table crop_health_reports enable row level security;

-- Allow inserts from the backend (using the anon key) for this hackathon prototype.
-- In production, you'd restrict this further (e.g. service role key on backend only).
create policy "Allow inserts for crop health reports"
  on crop_health_reports
  for insert
  to anon
  with check (true);

-- Allow reads so an RSK dashboard (or the farmer) can view report status later.
create policy "Allow reads for crop health reports"
  on crop_health_reports
  for select
  to anon
  using (true);
