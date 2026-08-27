-- LEGACY MIGRATION: do not run for the current release.
-- Use SUPABASE-COMPLETE-UPGRADE.sql instead.
-- Run once in Supabase SQL Editor before deploying the Bled availability UI.
-- Existing schedules, vehicle assignments and drivers are preserved.

alter table public.work_schedule
  alter column shift_type drop not null;

alter table public.work_schedule
  add column if not exists bled boolean;

update public.work_schedule
set bled = false
where bled is null;

alter table public.work_schedule
  alter column bled set default false,
  alter column bled set not null;

create index if not exists work_schedule_bled_date_idx
  on public.work_schedule(work_date)
  where bled = true;
