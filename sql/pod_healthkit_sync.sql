-- Apple Health auto-logging. A user installs a companion app (e.g. Health Auto
-- Export) that watches HealthKit and POSTs completed workouts to Pod's webhook.
-- These NEVER count toward stakes — verified stays false always, same as any
-- gallery photo — since HealthKit data is user-editable on-device and has none
-- of the live-capture guarantee stakes verification depends on.

alter table profiles
  add column if not exists health_sync_token text unique;

alter table sessions
  add column if not exists source text not null default 'manual';

alter table sessions
  add column if not exists external_id text;

-- One row per (pod, user, external workout id) — prevents a re-sent export
-- window from creating duplicate logs. NULL external_id (manual logs) is
-- never constrained, since Postgres treats each NULL as distinct.
create unique index if not exists sessions_pod_user_external_idx
  on sessions (pod_id, user_id, external_id)
  where external_id is not null;
