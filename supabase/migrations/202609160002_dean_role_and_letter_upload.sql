-- Migration: 202609160002_dean_role_and_letter_upload.sql
-- Description: Add 'dean' role support to profiles and 'document_type' column to record_images

-- 1. Update profiles role constraint to include 'dean'
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'doctor', 'worker', 'faculty', 'admin', 'dean', 'unassigned'));

-- 2. Add document_type column to record_images table
alter table public.record_images
  add column if not exists document_type text default 'medical_certificate';

-- 3. Update handle_new_auth_user trigger to support 'dean'
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    case
      when new.raw_user_meta_data ->> 'role' in ('student', 'doctor', 'worker', 'faculty', 'admin', 'dean')
        then new.raw_user_meta_data ->> 'role'
      else 'unassigned'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
