-- Run once in Supabase SQL Editor before deploying the vehicle-assignment UI.
-- Existing schedules and vehicles are preserved.

do $$
declare
  cars_id_type text;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'work_schedule'
      and column_name = 'car_id'
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
      'alter table public.work_schedule add column car_id %s',
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
      and conname = 'work_schedule_car_id_fkey'
  ) then
    alter table public.work_schedule
      add constraint work_schedule_car_id_fkey
      foreign key (car_id)
      references public.cars(id)
      on delete set null;
  end if;
end $$;

create index if not exists work_schedule_car_id_idx
  on public.work_schedule(car_id);

alter table public.work_schedule enable row level security;

drop policy if exists "Drivers can delete own schedule" on public.work_schedule;
create policy "Drivers can delete own schedule"
  on public.work_schedule
  for delete
  to authenticated
  using (driver_id = (select auth.uid()));

drop policy if exists "Admins can update all schedules" on public.work_schedule;
create policy "Admins can update all schedules"
  on public.work_schedule
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.drivers
      where drivers.id = (select auth.uid())
        and drivers.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.drivers
      where drivers.id = (select auth.uid())
        and drivers.role = 'admin'
    )
  );
