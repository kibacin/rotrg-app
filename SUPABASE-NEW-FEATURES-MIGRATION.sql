-- LEGACY MIGRATION: do not run for the current release.
-- Use SUPABASE-COMPLETE-UPGRADE.sql instead.
-- ROTRG: receipts, personal assignment notifications and separate Bled vehicles.
-- Run this file once in Supabase SQL Editor BEFORE deploying the matching app code.
-- The migration is idempotent and can be run again safely.

begin;

-- ---------------------------------------------------------------------------
-- 1. A separate vehicle assignment for Bled
-- ---------------------------------------------------------------------------

do $$
declare
  cars_id_type text;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'work_schedule'
      and column_name = 'bled_car_id'
  ) then
    select format_type(attribute.atttypid, attribute.atttypmod)
      into cars_id_type
    from pg_attribute as attribute
    where attribute.attrelid = 'public.cars'::regclass
      and attribute.attname = 'id'
      and not attribute.attisdropped;

    if cars_id_type is null then
      raise exception 'Could not determine the type of public.cars.id';
    end if;

    execute format(
      'alter table public.work_schedule add column bled_car_id %s',
      cars_id_type
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.work_schedule'::regclass
      and conname = 'work_schedule_bled_car_id_fkey'
  ) then
    alter table public.work_schedule
      add constraint work_schedule_bled_car_id_fkey
      foreign key (bled_car_id)
      references public.cars(id)
      on delete set null;
  end if;
end $$;

create index if not exists work_schedule_bled_car_id_idx
  on public.work_schedule(bled_car_id);

-- ---------------------------------------------------------------------------
-- 2. Private receipt records
-- ---------------------------------------------------------------------------

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  receipt_type text not null,
  fuel_type text,
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  constraint receipts_receipt_type_check
    check (receipt_type in ('cash_ride', 'fuel')),
  constraint receipts_fuel_type_check
    check (
      (receipt_type = 'cash_ride' and fuel_type is null)
      or
      (receipt_type = 'fuel' and fuel_type in ('diesel', 'petrol'))
    )
);

create index if not exists receipts_driver_created_at_idx
  on public.receipts(driver_id, created_at desc);

create index if not exists receipts_type_created_at_idx
  on public.receipts(receipt_type, created_at desc);

alter table public.receipts enable row level security;

drop policy if exists "Drivers can upload own receipts" on public.receipts;
create policy "Drivers can upload own receipts"
  on public.receipts
  for insert
  to authenticated
  with check (
    driver_id = (select auth.uid())
    and exists (
      select 1
      from public.drivers
      where drivers.id = (select auth.uid())
        and drivers.role is distinct from 'admin'
    )
  );

drop policy if exists "Drivers can view own receipts" on public.receipts;
create policy "Drivers can view own receipts"
  on public.receipts
  for select
  to authenticated
  using (driver_id = (select auth.uid()));

drop policy if exists "Admins can view all receipts" on public.receipts;
create policy "Admins can view all receipts"
  on public.receipts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.drivers
      where drivers.id = (select auth.uid())
        and drivers.role = 'admin'
    )
  );

drop policy if exists "Admins can delete receipts" on public.receipts;
create policy "Admins can delete receipts"
  on public.receipts
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.drivers
      where drivers.id = (select auth.uid())
        and drivers.role = 'admin'
    )
  );

revoke all privileges on public.receipts from authenticated;
grant select, insert, delete on public.receipts to authenticated;

-- Receipt images are intentionally private and are NOT affected by the
-- 15-day cleanup job for the separate car-photos bucket.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'receipts',
  'receipts',
  false,
  10485760,
  array['image/*']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Drivers can upload own receipt images" on storage.objects;
create policy "Drivers can upload own receipt images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.drivers
      where drivers.id = (select auth.uid())
        and drivers.role is distinct from 'admin'
    )
  );

drop policy if exists "Drivers can view own receipt images" on storage.objects;
create policy "Drivers can view own receipt images"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Drivers can clean up own receipt uploads" on storage.objects;
create policy "Drivers can clean up own receipt uploads"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Admins can view all receipt images" on storage.objects;
create policy "Admins can view all receipt images"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'receipts'
    and exists (
      select 1
      from public.drivers
      where drivers.id = (select auth.uid())
        and drivers.role = 'admin'
    )
  );

drop policy if exists "Admins can delete receipt images" on storage.objects;
create policy "Admins can delete receipt images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'receipts'
    and exists (
      select 1
      from public.drivers
      where drivers.id = (select auth.uid())
        and drivers.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Personal in-app notifications
-- ---------------------------------------------------------------------------

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.drivers(id) on delete cascade,
  kind text not null default 'vehicle_assignment',
  title text not null,
  body text not null,
  url text not null default '/notifications',
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint user_notifications_kind_check
    check (kind in ('vehicle_assignment'))
);

create index if not exists user_notifications_user_created_at_idx
  on public.user_notifications(user_id, created_at desc);

alter table public.user_notifications enable row level security;

drop policy if exists "Users can view own notifications" on public.user_notifications;
create policy "Users can view own notifications"
  on public.user_notifications
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can mark own notifications read" on public.user_notifications;
create policy "Users can mark own notifications read"
  on public.user_notifications
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Admins can view all personal notifications" on public.user_notifications;
create policy "Admins can view all personal notifications"
  on public.user_notifications
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.drivers
      where drivers.id = (select auth.uid())
        and drivers.role = 'admin'
    )
  );

revoke all privileges on public.user_notifications from authenticated;
grant select on public.user_notifications to authenticated;
grant update (read_at) on public.user_notifications to authenticated;

notify pgrst, 'reload schema';

commit;
