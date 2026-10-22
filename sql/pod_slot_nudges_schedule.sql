-- Hourly move-time nudges.
-- Vercel's free plan only runs scheduled jobs once a day, so Supabase calls
-- Pod every hour instead (a couple of minutes past the hour).
--
-- Before running, replace the two placeholders:
--   YOUR_APP_URL     your live Pod address, e.g. https://pod-app-abc.vercel.app
--                    (no slash at the end)
--   YOUR_CRON_SECRET the CRON_SECRET value from Vercel > Settings >
--                    Environment Variables
--
-- Then: Supabase > SQL Editor > New query > paste > Run.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Re-running replaces the old schedule instead of adding a second one.
select cron.unschedule('pod-slot-nudges')
where exists (select 1 from cron.job where jobname = 'pod-slot-nudges');

select cron.schedule(
  'pod-slot-nudges',
  '2 * * * *',
  $$
  select net.http_get(
    url := 'YOUR_APP_URL/api/cron/slot-nudges',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET'),
    timeout_milliseconds := 30000
  );
  $$
);

-- To check it later: select * from cron.job_run_details order by start_time desc limit 5;
-- To stop it:        select cron.unschedule('pod-slot-nudges');
