-- Run this after deploying the Edge Function named cleanup-expired-media.
-- IMPORTANT: replace both placeholder values before running.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

select vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co',
  'rotrg_project_url',
  'ROTRG project URL used by the media cleanup cron'
);

select vault.create_secret(
  'YOUR_SERVICE_ROLE_KEY',
  'rotrg_service_role_key',
  'ROTRG service role key used only by the media cleanup cron'
);

select cron.unschedule(jobid)
from cron.job
where jobname in ('cleanup-old-car-photos-daily', 'cleanup-expired-media-hourly');

select cron.schedule(
  'cleanup-expired-media-hourly',
  '17 * * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'rotrg_project_url'
      order by created_at desc
      limit 1
    ) || '/functions/v1/cleanup-expired-media',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'rotrg_service_role_key'
        order by created_at desc
        limit 1
      )
    ),
    body := jsonb_build_object('scheduled_at', now())
  );
  $$
);

