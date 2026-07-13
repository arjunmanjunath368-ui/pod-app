-- Absence / re-engagement loop.
-- When someone goes quiet, Pod nudges *them* (never shames them to the pod) and
-- offers Pause at the moment it's actually useful. This column throttles the
-- nudge so it can't repeat daily.

alter table pod_members
  add column if not exists absent_nudged_at timestamptz;
