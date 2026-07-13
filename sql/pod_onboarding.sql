-- First-run walkthrough. Null = hasn't seen it yet.
alter table profiles
  add column if not exists onboarded_at timestamptz;
