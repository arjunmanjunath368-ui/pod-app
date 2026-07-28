-- Settlement + balance reminders. These two columns throttle the daily digest
-- so each event (a sub-week closing, a losing week's final stretch) is only
-- pushed once, no matter how many times the cron runs.

alter table pod_stakes
  add column if not exists last_week_notified integer not null default 0;

alter table pod_stakes
  add column if not exists warned_week_key text;
