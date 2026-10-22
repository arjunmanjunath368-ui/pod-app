-- Pod Home v2
-- Run this once in Supabase (SQL Editor > New query > paste > Run) BEFORE
-- pushing the Home v2 code. Safe to run more than once.

-- 1. Move times: when a member usually has time to move, and their time zone,
--    so Pod can nudge them at the start of their window. slot_nudged_on keeps
--    it to one nudge a day.
alter table profiles add column if not exists move_slots text[];
alter table profiles add column if not exists timezone text;
alter table profiles add column if not exists slot_nudged_on date;

-- 2. Auto-pause: set when Pod pauses someone after 7 quiet days. Logging
--    anything clears it and puts them straight back in.
alter table pod_members add column if not exists auto_paused_at timestamptz;

-- 3. Clean-up: WHOOP and Apple Health activities from BEFORE someone joined a
--    pod were being added to it (connecting imported a week of history). That
--    is what gave a brand-new member 3 active days on day one.
--    This removes only synced activities logged before that member joined that
--    pod. Manual logs and rest days are untouched.
--
--    Optional preview first (run on its own to see how many rows go):
--    select count(*) from sessions s join pod_members m
--      on m.pod_id = s.pod_id and m.user_id = s.user_id
--     where s.source in ('whoop', 'healthkit')
--       and coalesce(s.rest_day, false) = false
--       and s.logged_at < m.joined_at - interval '1 minute';
delete from sessions s
using pod_members m
where m.pod_id = s.pod_id
  and m.user_id = s.user_id
  and s.source in ('whoop', 'healthkit')
  and coalesce(s.rest_day, false) = false
  and s.logged_at < m.joined_at - interval '1 minute';
