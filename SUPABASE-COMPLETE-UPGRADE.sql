-- ROTRG complete production upgrade
-- Run this file once in Supabase SQL Editor before deploying the matching app.
-- It is idempotent and keeps existing users, schedules, photos and vehicles.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Shared account helpers
-- ---------------------------------------------------------------------------

alter table public.drivers
  add column if not exists active boolean;

update public.drivers set active = true where active is null;

alter table public.drivers
  alter column active set default true,
  alter column active set not null;

create or replace function public.current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.drivers
    where id = (select auth.uid())
      and active = true
  );
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.drivers
    where id = (select auth.uid())
      and role = 'admin'
      and active = true
  );
$$;

grant execute on function public.current_user_is_active() to authenticated;
grant execute on function public.current_user_is_admin() to authenticated;

alter table public.drivers enable row level security;
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'drivers'
  loop
    execute format('drop policy if exists %I on public.drivers', existing_policy.policyname);
  end loop;
end $$;

create policy "Active users can view driver directory"
  on public.drivers
  for select
  to authenticated
  using (public.current_user_is_active() or id = (select auth.uid()));

revoke insert, update, delete on public.drivers from authenticated;
grant select on public.drivers to authenticated;

-- ---------------------------------------------------------------------------
-- Schedule, Bled vehicle assignment and the 16:30 Ljubljana deadline
-- ---------------------------------------------------------------------------

alter table public.work_schedule
  alter column shift_type drop not null;

alter table public.work_schedule
  add column if not exists bled boolean;

update public.work_schedule set bled = false where bled is null;

alter table public.work_schedule
  alter column bled set default false,
  alter column bled set not null;

do $$
declare
  cars_id_type text;
begin
  select format_type(attribute.atttypid, attribute.atttypmod)
    into cars_id_type
  from pg_attribute as attribute
  where attribute.attrelid = 'public.cars'::regclass
    and attribute.attname = 'id'
    and not attribute.attisdropped;

  if cars_id_type is null then
    raise exception 'Could not determine the type of public.cars.id';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'work_schedule' and column_name = 'car_id'
  ) then
    execute format('alter table public.work_schedule add column car_id %s', cars_id_type);
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'work_schedule' and column_name = 'bled_car_id'
  ) then
    execute format('alter table public.work_schedule add column bled_car_id %s', cars_id_type);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.work_schedule'::regclass
      and conname = 'work_schedule_car_id_fkey'
  ) then
    alter table public.work_schedule
      add constraint work_schedule_car_id_fkey
      foreign key (car_id) references public.cars(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.work_schedule'::regclass
      and conname = 'work_schedule_bled_car_id_fkey'
  ) then
    alter table public.work_schedule
      add constraint work_schedule_bled_car_id_fkey
      foreign key (bled_car_id) references public.cars(id) on delete set null;
  end if;
end $$;

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
  alter column shift_type drop default,
  alter column shift_type type text using shift_type::text;

alter table public.work_schedule
  add constraint work_schedule_shift_type_check
  check (
    shift_type is null
    or shift_type in ('07:00', '15:30', 'whole_day', 'first', 'second', 'third', 'off')
    or shift_type ~ '^other[|]([01][0-9]|2[0-3]):[0-5][0-9][|]([01][0-9]|2[0-3]):[0-5][0-9]$'
  );

create unique index if not exists work_schedule_driver_date_unique
  on public.work_schedule(driver_id, work_date);
create index if not exists work_schedule_car_id_idx on public.work_schedule(car_id);
create index if not exists work_schedule_bled_car_id_idx on public.work_schedule(bled_car_id);
create index if not exists work_schedule_bled_date_idx
  on public.work_schedule(work_date) where bled = true;

alter table public.work_schedule enable row level security;
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'work_schedule'
  loop
    execute format('drop policy if exists %I on public.work_schedule', existing_policy.policyname);
  end loop;
end $$;

create policy "Active users can view permitted schedules"
  on public.work_schedule
  for select
  to authenticated
  using (
    public.current_user_is_active()
    and (driver_id = (select auth.uid()) or public.current_user_is_admin())
  );

revoke insert, update, delete on public.work_schedule from authenticated;
grant select on public.work_schedule to authenticated;

alter table public.cars enable row level security;
drop policy if exists "Active users can view vehicles" on public.cars;
create policy "Active users can view vehicles"
  on public.cars
  for select
  to authenticated
  using (public.current_user_is_active());
revoke insert, update, delete on public.cars from authenticated;
grant select on public.cars to authenticated;

create table if not exists public.schedule_activity (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  work_date date not null,
  change_type text not null check (change_type in ('shift', 'bled')),
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create index if not exists schedule_activity_created_at_idx
  on public.schedule_activity(created_at desc);
create index if not exists schedule_activity_driver_date_idx
  on public.schedule_activity(driver_id, work_date, created_at desc);

alter table public.schedule_activity enable row level security;
drop policy if exists "Admins can view schedule activity" on public.schedule_activity;
create policy "Admins can view schedule activity"
  on public.schedule_activity for select to authenticated
  using (public.current_user_is_admin());

revoke all privileges on public.schedule_activity from authenticated;
grant select on public.schedule_activity to authenticated;

create or replace function public.enforce_driver_schedule_deadline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_date date;
  local_now timestamp;
begin
  if (select auth.uid()) is null or public.current_user_is_admin() then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  target_date := case when tg_op = 'DELETE' then old.work_date else new.work_date end;
  local_now := timezone('Europe/Ljubljana', now());

  if target_date <= local_now::date then
    raise exception 'SCHEDULE_LOCKED: Today and past days cannot be changed';
  end if;

  if target_date = local_now::date + 1 and local_now::time >= time '16:30' then
    raise exception 'SCHEDULE_LOCKED: Tomorrow is locked because the 16:30 deadline has passed';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_driver_schedule_deadline_trigger on public.work_schedule;
create trigger enforce_driver_schedule_deadline_trigger
before insert or update or delete on public.work_schedule
for each row execute function public.enforce_driver_schedule_deadline();

-- ---------------------------------------------------------------------------
-- Personal notifications (vehicle, schedule and chat mentions)
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
  created_at timestamptz not null default now()
);

do $$
declare
  existing_check record;
begin
  for existing_check in
    select constraint_name.conname
    from pg_constraint as constraint_name
    where constraint_name.conrelid = 'public.user_notifications'::regclass
      and constraint_name.contype = 'c'
      and pg_get_constraintdef(constraint_name.oid) ilike '%kind%'
  loop
    execute format(
      'alter table public.user_notifications drop constraint %I',
      existing_check.conname
    );
  end loop;
end $$;

alter table public.user_notifications
  add constraint user_notifications_kind_check
  check (kind in ('vehicle_assignment', 'schedule_change', 'chat_mention'));

create index if not exists user_notifications_user_created_at_idx
  on public.user_notifications(user_id, created_at desc);

alter table public.user_notifications enable row level security;
drop policy if exists "Admins can view all personal notifications" on public.user_notifications;
drop policy if exists "Users can view own notifications" on public.user_notifications;
create policy "Users can view own notifications"
  on public.user_notifications for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Users can mark own notifications read" on public.user_notifications;
create policy "Users can mark own notifications read"
  on public.user_notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all privileges on public.user_notifications from authenticated;
grant select on public.user_notifications to authenticated;
grant update (read_at) on public.user_notifications to authenticated;

create or replace function public.apply_driver_schedule_change(
  p_driver_id uuid,
  p_work_date date,
  p_change_type text,
  p_shift_type text default null,
  p_bled boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  local_now timestamp := timezone('Europe/Ljubljana', now());
  current_schedule public.work_schedule%rowtype;
  saved_schedule public.work_schedule%rowtype;
  driver_name text;
  old_value text;
  new_value text;
  notification_title text;
  notification_body text;
  activity_id uuid;
  admin_ids uuid[] := array[]::uuid[];
  unchanged boolean := false;
begin
  if p_change_type not in ('shift', 'bled') then
    raise exception 'Invalid schedule change type';
  end if;

  if p_work_date <= local_now::date then
    raise exception 'SCHEDULE_LOCKED: Today and past days cannot be changed';
  end if;

  if p_work_date = local_now::date + 1 and local_now::time >= time '16:30' then
    raise exception 'SCHEDULE_LOCKED: Tomorrow is locked because the 16:30 deadline has passed';
  end if;

  select full_name into driver_name
  from public.drivers
  where id = p_driver_id and role is distinct from 'admin' and active = true;

  if driver_name is null then
    raise exception 'The driver account is not active';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_driver_id::text || ':' || p_work_date::text, 0));

  select * into current_schedule
  from public.work_schedule
  where driver_id = p_driver_id and work_date = p_work_date
  for update;

  if p_change_type = 'shift' then
    if p_shift_type is not null
       and p_shift_type not in ('07:00', '15:30', 'whole_day')
       and p_shift_type !~ '^other[|]([01][0-9]|2[0-3]):[0-5][0-9][|]([01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception 'Invalid shift value';
    end if;

    old_value := current_schedule.shift_type;
    new_value := p_shift_type;

    if current_schedule.id is null and p_shift_type is null then
      unchanged := true;
    elsif current_schedule.id is null then
      insert into public.work_schedule(driver_id, work_date, shift_type, bled)
      values (p_driver_id, p_work_date, p_shift_type, false)
      returning * into saved_schedule;
    elsif current_schedule.shift_type is not distinct from p_shift_type then
      saved_schedule := current_schedule;
      unchanged := true;
    elsif p_shift_type is null and current_schedule.bled = false then
      delete from public.work_schedule where id = current_schedule.id;
      saved_schedule.id := null;
      saved_schedule.shift_type := null;
      saved_schedule.bled := false;
    else
      update public.work_schedule
      set shift_type = p_shift_type,
          car_id = case when p_shift_type is null then null else car_id end
      where id = current_schedule.id
      returning * into saved_schedule;
    end if;

    notification_title := 'Driver schedule updated';
    notification_body := driver_name || ' · ' || to_char(p_work_date, 'Dy, DD Mon') || ': ' ||
      case
        when p_shift_type is null then 'regular shift removed'
        when p_shift_type in ('07:00', 'first') and extract(isodow from p_work_date) in (6, 7)
          then 'shift set to 7:00–15:30'
        when p_shift_type in ('07:00', 'first') then 'shift set to 6:00–14:45'
        when p_shift_type in ('15:30', 'second') and extract(isodow from p_work_date) in (6, 7)
          then 'shift set to 15:30'
        when p_shift_type in ('15:30', 'second') then 'shift set to 14:45'
        when p_shift_type = 'whole_day' then 'shift set to Whole day'
        else 'shift set to ' || p_shift_type
      end;
  else
    if p_bled is null then
      raise exception 'Bled availability is required';
    end if;

    old_value := case when coalesce(current_schedule.bled, false) then 'yes' else 'no' end;
    new_value := case when p_bled then 'yes' else 'no' end;

    if current_schedule.id is null and p_bled = false then
      unchanged := true;
    elsif current_schedule.id is null then
      insert into public.work_schedule(driver_id, work_date, shift_type, bled)
      values (p_driver_id, p_work_date, null, true)
      returning * into saved_schedule;
    elsif current_schedule.bled = p_bled then
      saved_schedule := current_schedule;
      unchanged := true;
    elsif p_bled = false and current_schedule.shift_type is null then
      delete from public.work_schedule where id = current_schedule.id;
      saved_schedule.id := null;
      saved_schedule.shift_type := null;
      saved_schedule.bled := false;
    else
      update public.work_schedule
      set bled = p_bled,
          bled_car_id = case when p_bled then bled_car_id else null end
      where id = current_schedule.id
      returning * into saved_schedule;
    end if;

    notification_title := 'Bled availability updated';
    notification_body := driver_name || ' · ' || to_char(p_work_date, 'Dy, DD Mon') ||
      ': Bled set to ' || case when p_bled then 'Yes' else 'No' end;
  end if;

  if unchanged then
    return jsonb_build_object(
      'schedule', jsonb_build_object(
        'id', current_schedule.id,
        'shift_type', current_schedule.shift_type,
        'bled', coalesce(current_schedule.bled, false),
        'unchanged', true
      ),
      'notification', null
    );
  end if;

  insert into public.schedule_activity(driver_id, work_date, change_type, old_value, new_value)
  values (p_driver_id, p_work_date, p_change_type, old_value, new_value)
  returning id into activity_id;

  select coalesce(array_agg(id), array[]::uuid[]) into admin_ids
  from public.drivers
  where role = 'admin' and active = true;

  if cardinality(admin_ids) > 0 then
    insert into public.user_notifications(user_id, kind, title, body, url, metadata)
    select
      admin_id,
      'schedule_change',
      notification_title,
      notification_body,
      '/notifications',
      jsonb_build_object(
        'activity_id', activity_id,
        'driver_id', p_driver_id,
        'work_date', p_work_date,
        'change_type', p_change_type
      )
    from unnest(admin_ids) as admins(admin_id);
  end if;

  return jsonb_build_object(
    'schedule', jsonb_build_object(
      'id', saved_schedule.id,
      'shift_type', saved_schedule.shift_type,
      'bled', coalesce(saved_schedule.bled, false),
      'unchanged', false
    ),
    'notification', jsonb_build_object(
      'title', notification_title,
      'body', notification_body,
      'admin_ids', admin_ids,
      'activity_id', activity_id
    )
  );
end;
$$;

revoke all on function public.apply_driver_schedule_change(uuid, date, text, text, boolean) from public, anon, authenticated;
grant execute on function public.apply_driver_schedule_change(uuid, date, text, text, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- Vehicle photo reports: 6-8 camera photos, retained for 30 days
-- ---------------------------------------------------------------------------

do $$
declare
  cars_id_type text;
begin
  if to_regclass('public.car_reports') is null then
    select format_type(attribute.atttypid, attribute.atttypmod)
      into cars_id_type
    from pg_attribute as attribute
    where attribute.attrelid = 'public.cars'::regclass
      and attribute.attname = 'id'
      and not attribute.attisdropped;

    execute format($create$
      create table public.car_reports (
        id uuid primary key default gen_random_uuid(),
        car_id %s not null references public.cars(id) on delete restrict,
        driver_id uuid not null references public.drivers(id) on delete cascade,
        status text not null default 'draft' check (status in ('draft', 'submitted')),
        created_at timestamptz not null default now(),
        submitted_at timestamptz
      )
    $create$, cars_id_type);
  end if;
end $$;

alter table public.car_photos add column if not exists report_id uuid;
alter table public.car_photos add column if not exists storage_path text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.car_photos'::regclass
      and conname = 'car_photos_report_id_fkey'
  ) then
    alter table public.car_photos
      add constraint car_photos_report_id_fkey
      foreign key (report_id) references public.car_reports(id) on delete cascade;
  end if;
end $$;

create index if not exists car_reports_driver_created_idx
  on public.car_reports(driver_id, created_at desc);
create index if not exists car_reports_car_created_idx
  on public.car_reports(car_id, created_at desc);
create index if not exists car_photos_report_id_idx
  on public.car_photos(report_id);
create unique index if not exists car_photos_storage_path_unique
  on public.car_photos(storage_path) where storage_path is not null;

alter table public.car_reports enable row level security;
drop policy if exists "Drivers can create own draft reports" on public.car_reports;
create policy "Drivers can create own draft reports"
  on public.car_reports for insert to authenticated
  with check (
    driver_id = (select auth.uid())
    and status = 'draft'
    and public.current_user_is_active()
    and not public.current_user_is_admin()
  );
drop policy if exists "Users can view permitted car reports" on public.car_reports;
create policy "Users can view permitted car reports"
  on public.car_reports for select to authenticated
  using (driver_id = (select auth.uid()) or public.current_user_is_admin());
drop policy if exists "Drivers can delete own draft reports" on public.car_reports;
create policy "Drivers can delete own draft reports"
  on public.car_reports for delete to authenticated
  using (driver_id = (select auth.uid()) and status = 'draft');

revoke all privileges on public.car_reports from authenticated;
grant select, insert, delete on public.car_reports to authenticated;

alter table public.car_photos enable row level security;
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'car_photos'
  loop
    execute format('drop policy if exists %I on public.car_photos', existing_policy.policyname);
  end loop;
end $$;

create policy "Users can view permitted report photos"
  on public.car_photos for select to authenticated
  using (driver_id = (select auth.uid()) or public.current_user_is_admin());
revoke all privileges on public.car_photos from authenticated;
grant select on public.car_photos to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('car-photos', 'car-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.is_own_draft_car_report_path(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  folders text[];
  report_uuid uuid;
begin
  folders := storage.foldername(object_name);
  if array_length(folders, 1) < 2 or folders[1] <> (select auth.uid())::text then
    return false;
  end if;
  report_uuid := folders[2]::uuid;
  return exists (
    select 1 from public.car_reports
    where id = report_uuid
      and driver_id = (select auth.uid())
      and status = 'draft'
  );
exception when others then
  return false;
end;
$$;

grant execute on function public.is_own_draft_car_report_path(text) to authenticated;

drop policy if exists "Drivers can upload camera report photos" on storage.objects;
create policy "Drivers can upload camera report photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'car-photos'
    and public.current_user_is_active()
    and public.is_own_draft_car_report_path(name)
  );
drop policy if exists "Drivers can clean own draft report photos" on storage.objects;
create policy "Drivers can clean own draft report photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'car-photos'
    and public.is_own_draft_car_report_path(name)
  );

create or replace function public.finalize_car_report(
  p_report_id uuid,
  p_driver_id uuid,
  p_paths text[],
  p_urls text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  report_row public.car_reports%rowtype;
  photo_count integer := coalesce(array_length(p_paths, 1), 0);
begin
  if photo_count < 6 or photo_count > 8 or photo_count <> coalesce(array_length(p_urls, 1), 0) then
    raise exception 'A vehicle report must contain between 6 and 8 photos';
  end if;

  select * into report_row
  from public.car_reports
  where id = p_report_id and driver_id = p_driver_id
  for update;

  if report_row.id is null or report_row.status <> 'draft' then
    raise exception 'The draft vehicle report was not found';
  end if;

  if exists (select 1 from public.car_photos where report_id = p_report_id) then
    raise exception 'This vehicle report was already finalized';
  end if;

  insert into public.car_photos(
    car_id,
    driver_id,
    photo_url,
    storage_path,
    report_id,
    uploaded_at
  )
  select
    report_row.car_id,
    p_driver_id,
    p_urls[position],
    p_paths[position],
    p_report_id,
    now()
  from generate_subscripts(p_paths, 1) as positions(position);

  update public.car_reports
  set status = 'submitted', submitted_at = now()
  where id = p_report_id;

  return jsonb_build_object('id', p_report_id, 'photo_count', photo_count, 'status', 'submitted');
end;
$$;

revoke all on function public.finalize_car_report(uuid, uuid, text[], text[]) from public, anon, authenticated;
grant execute on function public.finalize_car_report(uuid, uuid, text[], text[]) to service_role;

-- ---------------------------------------------------------------------------
-- Driver receipts, retained for 30 days
-- ---------------------------------------------------------------------------

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  receipt_type text not null,
  fuel_type text,
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  constraint receipts_receipt_type_check check (receipt_type in ('cash_ride', 'fuel')),
  constraint receipts_fuel_type_check check (
    (receipt_type = 'cash_ride' and fuel_type is null)
    or (receipt_type = 'fuel' and fuel_type in ('diesel', 'petrol'))
  )
);

create index if not exists receipts_driver_created_at_idx
  on public.receipts(driver_id, created_at desc);
create index if not exists receipts_type_created_at_idx
  on public.receipts(receipt_type, created_at desc);

alter table public.receipts enable row level security;
drop policy if exists "Drivers can upload own receipts" on public.receipts;
create policy "Drivers can upload own receipts"
  on public.receipts for insert to authenticated
  with check (
    driver_id = (select auth.uid())
    and public.current_user_is_active()
    and not public.current_user_is_admin()
  );
drop policy if exists "Drivers can view own receipts" on public.receipts;
create policy "Drivers can view own receipts"
  on public.receipts for select to authenticated
  using (driver_id = (select auth.uid()));
drop policy if exists "Admins can view all receipts" on public.receipts;
create policy "Admins can view all receipts"
  on public.receipts for select to authenticated
  using (public.current_user_is_admin());
drop policy if exists "Admins can delete receipts" on public.receipts;
create policy "Admins can delete receipts"
  on public.receipts for delete to authenticated
  using (public.current_user_is_admin());

revoke all privileges on public.receipts from authenticated;
grant select, insert, delete on public.receipts to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760, array['image/*'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Drivers can upload own receipt images" on storage.objects;
create policy "Drivers can upload own receipt images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.current_user_is_active()
    and not public.current_user_is_admin()
  );
drop policy if exists "Drivers can view own receipt images" on storage.objects;
create policy "Drivers can view own receipt images"
  on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Drivers can clean up own receipt uploads" on storage.objects;
create policy "Drivers can clean up own receipt uploads"
  on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Admins can view all receipt images" on storage.objects;
create policy "Admins can view all receipt images"
  on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.current_user_is_admin());
drop policy if exists "Admins can delete receipt images" on storage.objects;
create policy "Admins can delete receipt images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and public.current_user_is_admin());

-- ---------------------------------------------------------------------------
-- Announcements with up to three images and exact 48-hour visibility
-- ---------------------------------------------------------------------------

alter table public.announcements add column if not exists expires_at timestamptz;
update public.announcements
set expires_at = created_at + interval '48 hours'
where expires_at is null;
alter table public.announcements
  alter column expires_at set default (now() + interval '48 hours'),
  alter column expires_at set not null;
create index if not exists announcements_expires_at_idx on public.announcements(expires_at);

alter table public.announcements enable row level security;
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'announcements'
  loop
    execute format('drop policy if exists %I on public.announcements', existing_policy.policyname);
  end loop;
end $$;

create policy "Active users can view live announcements"
  on public.announcements
  for select
  to authenticated
  using (public.current_user_is_active() and expires_at > now());
revoke insert, update, delete on public.announcements from authenticated;
grant select on public.announcements to authenticated;

do $$
declare
  announcement_id_type text;
begin
  if to_regclass('public.announcement_images') is null then
    select format_type(attribute.atttypid, attribute.atttypmod)
      into announcement_id_type
    from pg_attribute as attribute
    where attribute.attrelid = 'public.announcements'::regclass
      and attribute.attname = 'id'
      and not attribute.attisdropped;

    execute format($create$
      create table public.announcement_images (
        id uuid primary key default gen_random_uuid(),
        announcement_id %s not null references public.announcements(id) on delete cascade,
        storage_path text not null unique,
        sort_order smallint not null default 0 check (sort_order between 0 and 2),
        created_at timestamptz not null default now()
      )
    $create$, announcement_id_type);
  end if;
end $$;

create index if not exists announcement_images_announcement_idx
  on public.announcement_images(announcement_id, sort_order);

create or replace function public.limit_announcement_images()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from public.announcement_images where announcement_id = new.announcement_id) >= 3 then
    raise exception 'An announcement can contain up to three images';
  end if;
  return new;
end;
$$;

drop trigger if exists limit_announcement_images_trigger on public.announcement_images;
create trigger limit_announcement_images_trigger
before insert on public.announcement_images
for each row execute function public.limit_announcement_images();

alter table public.announcement_images enable row level security;
drop policy if exists "Active users can view announcement images" on public.announcement_images;
create policy "Active users can view announcement images"
  on public.announcement_images for select to authenticated
  using (
    public.current_user_is_active()
    and exists (
      select 1 from public.announcements
      where announcements.id = announcement_images.announcement_id
        and announcements.expires_at > now()
    )
  );
grant select on public.announcement_images to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('announcement-images', 'announcement-images', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Active users can view announcement media" on storage.objects;
create policy "Active users can view announcement media"
  on storage.objects for select to authenticated
  using (bucket_id = 'announcement-images' and public.current_user_is_active());

-- ---------------------------------------------------------------------------
-- Vehicle service history and vehicle creation (admin-only via server API)
-- ---------------------------------------------------------------------------

do $$
declare
  cars_id_type text;
begin
  if to_regclass('public.vehicle_service_reports') is null then
    select format_type(attribute.atttypid, attribute.atttypmod)
      into cars_id_type
    from pg_attribute as attribute
    where attribute.attrelid = 'public.cars'::regclass
      and attribute.attname = 'id'
      and not attribute.attisdropped;

    execute format($create$
      create table public.vehicle_service_reports (
        id uuid primary key default gen_random_uuid(),
        car_id %s not null references public.cars(id) on delete restrict,
        admin_id uuid not null references public.drivers(id) on delete restrict,
        service_date date not null,
        provider text,
        odometer_km integer check (odometer_km is null or odometer_km >= 0),
        issue_description text not null,
        work_performed text not null,
        notes text,
        cost_eur numeric(12,2) check (cost_eur is null or cost_eur >= 0),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $create$, cars_id_type);
  end if;
end $$;

create index if not exists vehicle_service_reports_car_date_idx
  on public.vehicle_service_reports(car_id, service_date desc, created_at desc);

alter table public.vehicle_service_reports enable row level security;
drop policy if exists "Admins can view service reports" on public.vehicle_service_reports;
create policy "Admins can view service reports"
  on public.vehicle_service_reports for select to authenticated
  using (public.current_user_is_admin());
revoke all privileges on public.vehicle_service_reports from authenticated;
grant select on public.vehicle_service_reports to authenticated;

-- ---------------------------------------------------------------------------
-- Company group chat with mentions
-- ---------------------------------------------------------------------------

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.drivers(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.chat_mentions (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  mentioned_user_id uuid not null references public.drivers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, mentioned_user_id)
);

create table if not exists public.chat_reads (
  user_id uuid primary key references public.drivers(id) on delete cascade,
  last_read_at timestamptz not null default now()
);

create index if not exists chat_messages_created_at_idx on public.chat_messages(created_at desc);
create index if not exists chat_mentions_user_idx on public.chat_mentions(mentioned_user_id, created_at desc);

alter table public.chat_messages enable row level security;
alter table public.chat_mentions enable row level security;
alter table public.chat_reads enable row level security;

drop policy if exists "Active users can view group chat" on public.chat_messages;
create policy "Active users can view group chat"
  on public.chat_messages for select to authenticated
  using (public.current_user_is_active());
drop policy if exists "Active users can view chat mentions" on public.chat_mentions;
create policy "Active users can view chat mentions"
  on public.chat_mentions for select to authenticated
  using (public.current_user_is_active());
drop policy if exists "Users can view own chat read state" on public.chat_reads;
create policy "Users can view own chat read state"
  on public.chat_reads for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Users can create own chat read state" on public.chat_reads;
create policy "Users can create own chat read state"
  on public.chat_reads for insert to authenticated
  with check (user_id = (select auth.uid()) and public.current_user_is_active());
drop policy if exists "Users can update own chat read state" on public.chat_reads;
create policy "Users can update own chat read state"
  on public.chat_reads for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all privileges on public.chat_messages from authenticated;
revoke all privileges on public.chat_mentions from authenticated;
revoke all privileges on public.chat_reads from authenticated;
grant select on public.chat_messages, public.chat_mentions to authenticated;
grant select, insert, update (last_read_at) on public.chat_reads to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
