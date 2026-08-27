-- Safe, read-only verification after the ROTRG upgrade.

select
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'drivers' and column_name = 'active'
  ) as active_drivers_ready,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'work_schedule' and column_name = 'bled_car_id'
  ) as bled_vehicle_ready,
  to_regclass('public.schedule_activity') is not null as schedule_activity_ready,
  to_regclass('public.user_notifications') is not null as notifications_ready,
  to_regclass('public.car_reports') is not null as car_reports_ready,
  to_regclass('public.receipts') is not null as receipts_ready,
  to_regclass('public.announcement_images') is not null as announcement_images_ready,
  to_regclass('public.vehicle_service_reports') is not null as service_reports_ready,
  to_regclass('public.chat_messages') is not null as chat_ready,
  to_regprocedure('public.apply_driver_schedule_change(uuid,date,text,text,boolean)') is not null
    as schedule_rpc_ready,
  to_regprocedure('public.finalize_car_report(uuid,uuid,text[],text[])') is not null
    as car_report_rpc_ready,
  exists (select 1 from storage.buckets where id = 'car-photos') as car_photos_bucket_ready,
  exists (select 1 from storage.buckets where id = 'receipts' and public = false)
    as private_receipts_bucket_ready,
  exists (select 1 from storage.buckets where id = 'announcement-images' and public = false)
    as private_announcement_bucket_ready,
  exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) as chat_realtime_ready,
  (
    select count(*)
    from cron.job
    where jobname = 'cleanup-expired-media-hourly'
  ) as cleanup_cron_jobs;
