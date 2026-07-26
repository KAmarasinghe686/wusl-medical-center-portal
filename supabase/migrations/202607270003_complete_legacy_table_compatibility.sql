-- Complete the legacy-table upgrade that CREATE TABLE IF NOT EXISTS cannot
-- perform when an older hosted table already exists.

alter table public.notifications
  add column if not exists type text not null default 'system';

alter table public.notifications
  alter column type set default 'system';

alter table public.students
  add column if not exists created_at timestamptz not null default now();

alter table public.students
  alter column created_at set default now();

-- A legacy Technology student predates the Applied Sciences-only rule. Keep
-- that row while retaining the NOT VALID constraint for all new/changed rows.
alter table public.students
  drop constraint if exists students_applied_science_index_check;

alter table public.students
  alter column academic_year type text using academic_year::text;

alter table public.students
  add constraint students_applied_science_index_check
  check (index_no ~ '^2[0-9]2[0-9]{3}$') not valid;

alter table public.doctors
  add column if not exists created_at timestamptz not null default now();

alter table public.doctors
  alter column created_at set default now();

alter table public.record_images
  add column if not exists created_at timestamptz not null default now();

alter table public.record_images
  alter column created_at set default now();
