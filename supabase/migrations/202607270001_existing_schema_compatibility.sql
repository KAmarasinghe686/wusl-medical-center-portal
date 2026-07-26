-- Bring tables that existed before version-controlled migrations up to the
-- constraints and columns expected by the portal functions and triggers.

alter table public.audit_logs
  add column if not exists old_data jsonb,
  add column if not exists new_data jsonb;

create unique index if not exists students_user_id_unique
  on public.students(user_id);

create unique index if not exists doctors_user_id_unique
  on public.doctors(user_id);
