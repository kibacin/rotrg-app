-- LEGACY MIGRATION: do not run for the current release.
-- Use SUPABASE-COMPLETE-UPGRADE.sql instead.
-- Run this once in Supabase SQL Editor if work_schedule.shift_type currently
-- uses an enum or an old CHECK constraint. Existing values remain valid.

do $$
declare
  existing_check record;
begin
  for existing_check in
    select constraint_name.conname
    from pg_constraint as constraint_name
    where constraint_name.conrelid = 'public.work_schedule'::regclass
      and constraint_name.contype = 'c'
      and pg_get_constraintdef(constraint_name.oid) ilike '%shift_type%'
  loop
    execute format(
      'alter table public.work_schedule drop constraint %I',
      existing_check.conname
    );
  end loop;
end $$;

alter table public.work_schedule
  alter column shift_type drop default;

alter table public.work_schedule
  alter column shift_type type text using shift_type::text;

alter table public.work_schedule
  add constraint work_schedule_shift_type_check
  check (
    shift_type is null
    or shift_type in (
      '07:00',
      '15:30',
      'whole_day',
      'first',
      'second',
      'third',
      'off'
    )
    or shift_type ~ '^other[|]([01][0-9]|2[0-3]):[0-5][0-9][|]([01][0-9]|2[0-3]):[0-5][0-9]$'
  );
