-- ROTRG production hotfix: admin uploads and group chat notification mute.
-- Safe to run more than once. Existing users, reports, receipts and messages are kept.

begin;

-- ---------------------------------------------------------------------------
-- Account-wide group chat notification preference. Existing users stay unmuted.
-- ---------------------------------------------------------------------------

alter table public.drivers
  add column if not exists chat_notifications_muted boolean;

update public.drivers
set chat_notifications_muted = false
where chat_notifications_muted is null;

alter table public.drivers
  alter column chat_notifications_muted set default false,
  alter column chat_notifications_muted set not null;

-- Store ordinary chat messages as personal notifications as well as @mentions.
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
  check (kind in ('vehicle_assignment', 'schedule_change', 'chat_mention', 'chat_message'));

-- ---------------------------------------------------------------------------
-- Every active account, including administrators, can create its own car report.
-- ---------------------------------------------------------------------------

drop policy if exists "Drivers can create own draft reports" on public.car_reports;
drop policy if exists "Active users can create own draft reports" on public.car_reports;
create policy "Active users can create own draft reports"
  on public.car_reports
  for insert
  to authenticated
  with check (
    driver_id = (select auth.uid())
    and status = 'draft'
    and public.current_user_is_active()
  );

drop policy if exists "Drivers can upload camera report photos" on storage.objects;
drop policy if exists "Active users can upload camera report photos" on storage.objects;
create policy "Active users can upload camera report photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'car-photos'
    and public.current_user_is_active()
    and public.is_own_draft_car_report_path(name)
  );

-- ---------------------------------------------------------------------------
-- Every active account, including administrators, can upload its own receipts.
-- ---------------------------------------------------------------------------

drop policy if exists "Drivers can upload own receipts" on public.receipts;
drop policy if exists "Active users can upload own receipts" on public.receipts;
create policy "Active users can upload own receipts"
  on public.receipts
  for insert
  to authenticated
  with check (
    driver_id = (select auth.uid())
    and public.current_user_is_active()
  );

drop policy if exists "Drivers can upload own receipt images" on storage.objects;
drop policy if exists "Active users can upload own receipt images" on storage.objects;
create policy "Active users can upload own receipt images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.current_user_is_active()
  );

notify pgrst, 'reload schema';

commit;
