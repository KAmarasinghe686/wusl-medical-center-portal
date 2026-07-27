-- Legacy hosted profiles tables may retain an older role constraint even
-- after the baseline CREATE TABLE IF NOT EXISTS migration. The auth trigger
-- legitimately creates a temporary unassigned profile before onboarding links
-- the account to its institutional role.

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'doctor', 'worker', 'faculty', 'admin', 'unassigned'));
