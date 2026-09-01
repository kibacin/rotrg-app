-- Safe, read-only verification for SUPABASE-ADMIN-CAMERA-CHAT-HOTFIX.sql.

select
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'drivers'
      and column_name = 'chat_notifications_muted'
      and data_type = 'boolean'
      and is_nullable = 'NO'
  ) as chat_mute_ready,
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_notifications'::regclass
      and conname = 'user_notifications_kind_check'
      and pg_get_constraintdef(oid) ilike '%chat_message%'
  ) as chat_message_notifications_ready,
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'car_reports'
      and policyname = 'Active users can create own draft reports'
  ) as admin_car_reports_ready,
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Active users can upload camera report photos'
  ) as admin_car_photos_ready,
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'receipts'
      and policyname = 'Active users can upload own receipts'
  ) as admin_receipts_ready,
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Active users can upload own receipt images'
  ) as admin_receipt_images_ready;
